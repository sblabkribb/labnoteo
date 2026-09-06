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
  on(ev: 'data', cb: (chunk: unknown) => void): void;
  on(ev: 'end', cb: () => void): void;
}
interface NodeRes {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string): void;
}
interface NodeServer {
  listen(port: number, host: string, cb?: () => void): void;
  close(cb?: () => void): void;
}
interface NodeHttp {
  createServer(handler: (req: NodeReq, res: NodeRes) => void): NodeServer;
}

const WRITE_TOOLS = new Set(['create_sample', 'create_workflow', 'update_section']);
const DEFAULT_PORT = 3987;

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

    this.server = http.createServer((req, res) => {
      void this.handle(req, res);
    });
    this.server.listen(port, '127.0.0.1', () => {
      console.info(`[labnoteo] MCP server on http://127.0.0.1:${port} (token: ${this.token})`);
      new Notice(this.plugin.t('MCP server started on 127.0.0.1:{0}', String(port)));
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
    this.token = '';
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
    // Bearer auth (loopback still requires the token).
    const auth = headerValue(req.headers['authorization']);
    if (auth !== `Bearer ${this.token}`) {
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
        const allowed = await this.plugin.host.confirm(
          this.plugin.t('Allow MCP tool "{0}" to modify the vault?', name),
          { confirmLabel: this.plugin.t('Allow') }
        );
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
    const chunks: string[] = [];
    req.on('data', chunk => chunks.push(String(chunk)));
    req.on('end', () => resolve(chunks.join('')));
    (req as unknown as { on(ev: 'error', cb: (e: unknown) => void): void }).on('error', reject);
  });
}

function sendJson(res: NodeRes, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
