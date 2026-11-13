import type { PcStore } from '../scan/pcStore';

/** One consent per provider/address on this PC and vault; concurrent requests share a decision. */
export class TransmissionConsent {
  private readonly pending = new Map<string, Promise<boolean>>();
  private readonly accepted: Set<string>;
  constructor(private readonly store: PcStore, private readonly confirm: (address: string) => Promise<boolean>) {
    const saved = store.get<unknown>('ai-transmission-v1');
    this.accepted = new Set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : []);
  }
  allow(provider: string, endpoint: string): Promise<boolean> {
    const canonical = new URL(endpoint).href;
    const key = `${provider}\n${canonical}`;
    if (this.accepted.has(key)) return Promise.resolve(true);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const decision = Promise.resolve().then(async () => {
      if (!(await this.confirm(endpoint))) return false;
      this.accepted.add(key);
      try { this.store.set('ai-transmission-v1', [...this.accepted]); }
      catch (error) { this.accepted.delete(key); throw error; }
      return true;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, decision);
    return decision;
  }
}

export class TransmissionCancelled extends Error {
  constructor() { super('AI transmission cancelled'); }
}
