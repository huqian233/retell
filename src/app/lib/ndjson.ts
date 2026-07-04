import type { StreamEvent } from '../../shared/protocol';

export async function* readNdjson(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) yield JSON.parse(line) as StreamEvent;
    }
  }
  const tail = buf.trim();
  if (tail) yield JSON.parse(tail) as StreamEvent;
}
