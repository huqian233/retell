interface Oembed {
  title?: string;
  author_name?: string;
}

// 取标题/作者:oEmbed 无需鉴权、任意 IP 可用(已实测)。失败不阻断生成,给占位值。
export async function fetchOembed(videoId: string): Promise<{ title: string; author: string }> {
  const fallback = { title: 'YouTube 视频', author: '未知作者' };
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=https://youtu.be/${videoId}`);
    if (res.status !== 200) return fallback;
    const j = (await res.json()) as Oembed;
    return { title: j.title ?? fallback.title, author: j.author_name ?? fallback.author };
  } catch {
    return fallback;
  }
}
