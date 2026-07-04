interface TimedText {
  events?: Array<{ segs?: Array<{ utf8?: string }> }>;
}

export function parseTimedText(json: unknown): string {
  const events = (json as TimedText).events ?? [];
  const parts: string[] = [];
  for (const e of events) {
    if (!e.segs) continue;
    parts.push(e.segs.map((s) => s.utf8 ?? '').join(''));
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}
