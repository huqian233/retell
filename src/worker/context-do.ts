import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import type { Chapter } from '../shared/chapters';
import type { WHResult, SubtitleSource } from '../shared/protocol';

export interface StoredMeta {
  videoId: string;
  title: string;
  author: string;
  requirements?: string;
  subtitleSource: SubtitleSource;
  createdAt: number;
}

export interface StoredContext {
  meta: StoredMeta;
  transcript: string;
  chapters: Chapter[];
}

const TTL_MS = 24 * 60 * 60 * 1000;

export class GenerationContext extends DurableObject<Env> {
  private sql = this.ctx.storage.sql;

  async save(context: StoredContext): Promise<void> {
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');
    const put = (k: string, v: string) =>
      this.sql.exec('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', k, v);
    put('meta', JSON.stringify(context.meta));
    put('transcript', context.transcript);
    put('chapters', JSON.stringify(context.chapters));
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
  }

  async load(): Promise<StoredContext | null> {
    if (!this.tableExists()) return null;
    const rows = this.sql.exec('SELECT key, value FROM kv').toArray() as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const metaRaw = map.get('meta');
    if (!metaRaw) return null;
    return {
      meta: JSON.parse(metaRaw) as StoredMeta,
      transcript: map.get('transcript') ?? '',
      chapters: JSON.parse(map.get('chapters') ?? '[]') as Chapter[],
    };
  }

  async getWH(chapter: number): Promise<WHResult | null> {
    if (!this.tableExists()) return null;
    const rows = this.sql.exec('SELECT value FROM kv WHERE key = ?', `wh:${chapter}`).toArray() as { value: string }[];
    return rows.length ? (JSON.parse(rows[0]!.value) as WHResult) : null;
  }

  async putWH(chapter: number, wh: WHResult): Promise<void> {
    this.sql.exec('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', `wh:${chapter}`, JSON.stringify(wh));
  }

  async alarm(): Promise<void> {
    this.sql.exec('DROP TABLE IF EXISTS kv');
  }

  private tableExists(): boolean {
    return this.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='kv'").toArray().length > 0;
  }
}
