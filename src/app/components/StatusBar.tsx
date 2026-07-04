import type { Meta, Status } from '../hooks/useGeneration';

const PHASE: Record<Status, string> = {
  idle: '',
  fetching: '正在获取字幕…',
  streaming: '正在生成…',
  done: '已完成',
  error: '出错了',
};

export function StatusBar({ meta, status }: { meta: Meta; status: Status }) {
  return (
    <div className="statusbar">
      <span className="title">{meta.title}</span>
      {meta.author && <span>· {meta.author}</span>}
      <span className={`badge ${meta.subtitleSource}`}>
        {meta.subtitleSource === 'bundled' ? '字幕来源:内置样本' : '字幕来源:实时抓取'}
      </span>
      {PHASE[status] && <span>· {PHASE[status]}</span>}
    </div>
  );
}
