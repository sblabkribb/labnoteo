/**
 * In-process MCP-style tool server (desktop only).
 *
 * Exposes the core {@link createLabnoteTools} set over a minimal JSON-RPC 2.0
 * HTTP endpoint so external MCP clients (or the built-in commands) can call
 * Labnote tools against the current vault. Security posture:
 *
 * - **Loopback only** — binds `127.0.0.1`, never a routable interface.
 * - **Bearer token** — a random per-session token guards every request.
 * - **Write confirmation** — mutating tools prompt the user before executing.
 *
 * Guarded behind `Platform.isDesktopApp`; Node's `http` is required lazily so
 * the module still loads on mobile (where the feature is simply unavailable).
 */
import { Notice, Platform } from 'obsidian';
import { createLabnoteTools, runTool, type ToolContext, type ToolDef } from '@labnoteo/core';
import type LabnotePlugin from '../main';

// Available in the CommonJS bundle at runtime (desktop/Electron).
declare const require: (id: string) => unknown;

interface NodeReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  setEncoding(encoding: string): void;
  on(ev: 'data', cb: (chunk: unknown) => void): void;
  on(ev: 'end', cb: () => void): void;
  on(ev: 'error', cb: (e: unknown) => void): void;
}
interface NodeRes {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string): void;
}
interface NodeServer {
  listen(port: number, host: string, cb?: () => void): void;
  close(cb?: () => void): void;
  on(ev: 'error', cb: (e: unknown) => void): void;
}
interface NodeHttp {
  createServer(handler: (req: NodeReq, res: NodeRes) => void): NodeServer;
}

const WRITE_TOOLS = new Set(['create_sample', 'create_workflow', 'update_section']);
const DEFAULT_PORT = 3987;
/** Hard cap on a single JSON-RPC request body to avoid unbounded buffering. */
const MAX_BODY_BYTES = 1_000_000;

export class LabnoteMcpServer {
  private server: NodeServer | null = null;
  private token = '';
  private readonly tools: ToolDef[] = createLabnoteTools();

  constructor(private readonly plugin: LabnotePlugin) {}

  get running(): boolean {
    return this.server !== null;
  }

  start(port = DEFAULT_PORT): void {
    if (this.server) return;
    if (!Platform.isDesktopApp) {
      new Notice(this.plugin.t('MCP server is desktop-only.'));
      return;
    }

    const http = require('http') as NodeHttp;
    this.token = randomToken();

    const server = http.createServer((req, res) => {
      void this.handle(req, res);
    });
    // Without an 'error' listener a port conflict (e.g. the same plugin running
    // in another vault already holds 3987) throws as an uncaught exception and
    // crashes plugin init. Surface it as a Notice and reset to a stopped state.
    server.on('error', (err: unknown) => {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'EADDRINUSE') {
        new Notice(this.plugin.t('MCP server port {0} is already in use.', String(port)));
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        new Notice(this.plugin.t('MCP server error: {0}', msg));
      }
      this.server = null;
      this.token = '';
    });
    this.server = server;
    server.listen(port, '127.0.0.1', () => {
      // Do NOT log the bearer token; it would leak into the (shared) console.
      console.info(`[labnoteo] MCP server on http://127.0.0.1:${port}`);
      new Notice(this.plugin.t('MCP server started on 127.0.0.1:{0}', String(port)));
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
    this.token = '';
  }

  /** The active bearer token, or null when the server is not running. */
  currentToken(): string | null {
    return this.server && this.token ? this.token : null;
  }

  private context(): ToolContext {
    return {
      fs: this.plugin.fs,
      workspaceRoot: '.',
      globalSampleFolder: this.plugin.settings.globalSampleFolder,
      customTypes: this.plugin.settings.customSampleTypes,
    };
  }

  private async handle(req: NodeReq, res: NodeRes): Promise<void> {
    // Bearer auth (loopback still requires the token). Compared in constant time
    // so a network-local attacker can't recover the token byte-by-byte via
    // response-timing on early mismatch.
    const auth = headerValue(req.headers['authorization']);
    if (!this.token || !timingSafeEqual(auth, `Bearer ${this.token}`)) {
      return sendJson(res, 401, { error: 'unauthorized' });
    }
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'method not allowed' });
    }

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'bad request' });
    }

    let rpc: { id?: unknown; method?: string; params?: Record<string, unknown> };
    try {
      rpc = JSON.parse(body);
    } catch {
      return sendJson(res, 400, jsonRpcError(null, -32700, 'Parse error'));
    }

    const id = rpc.id ?? null;

    if (rpc.method === 'tools/list') {
      return sendJson(res, 200, {
        jsonrpc: '2.0',
        id,
        result: {
          tools: this.tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      });
    }

    if (rpc.method === 'tools/call') {
      const name = String(rpc.params?.name ?? '');
      const args = (rpc.params?.arguments as Record<string, unknown>) ?? {};

      if (WRITE_TOOLS.has(name)) {
        // Surface the write target so the user is not blind-approving by tool
        // name alone (an LLM could target any note/sample path).
        const target =
          typeof args.documentPath === 'string' && args.documentPath.length > 0
            ? args.documentPath
            : null;
        const prompt = this.plugin.t('Allow MCP tool "{0}" to modify the vault?', name);
        const message = target
          ? `${prompt}\n\n${this.plugin.t('Target: {0}', target)}`
          : prompt;
        const allowed = await this.plugin.host.confirm(message, {
          confirmLabel: this.plugin.t('Allow'),
        });
        if (!allowed) {
          return sendJson(res, 200, jsonRpcError(id, -32001, 'User denied write'));
        }
      }

      const result = await runTool(this.tools, name, this.context(), args);
      return sendJson(res, 200, {
        jsonrpc: '2.0',
        id,
        result: {
          isError: !result.ok,
          content: [{ type: 'text', text: JSON.stringify(result.data ?? result.error ?? null) }],
        },
      });
    }

    return sendJson(res, 200, jsonRpcError(id, -32601, `Method not found: ${rpc.method}`));
  }
}

// --- helpers ---------------------------------------------------------------

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function headerValue(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function readBody(req: NodeReq): Promise<string> {
  return new Promise((resolve, reject) => {
    // Decode as UTF-8 up front so multibyte characters split across chunk
    // boundaries are reassembled correctly (the old `String(chunk)` on a raw
    // Buffer could corrupt them). Enforce a size cap to bound memory.
    req.setEncoding('utf8');
    let body = '';
    let size = 0;
    req.on('data', (chunk: unknown) => {
      const s = typeof chunk === 'string' ? chunk : String(chunk);
      size += s.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        return;
      }
      body += s;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Constant-time string comparison. Returns as soon as the lengths differ (the
 * token length is not secret), but for equal lengths compares every character
 * so timing does not reveal the first mismatching position.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function sendJson(res: NodeRes, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
