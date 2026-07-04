import data from './bundled-data.json';

interface Bundled {
  videoId: string;
  title: string;
  author: string;
  transcript: string;
}

// 演示视频预热缓存:仅覆盖任务书指定的演示视频,来源标记为 bundled。
export const BUNDLED: Record<string, Bundled> = {
  [data.videoId]: { videoId: data.videoId, title: data.title, author: data.author, transcript: data.transcript },
};
