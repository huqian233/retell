import { useState } from 'react';

const SAMPLE = 'https://www.youtube.com/watch?v=xRh2sVcNXQ8';

export function HeroForm({ onSubmit, disabled }: { onSubmit: (url: string, requirements: string) => void; disabled: boolean }) {
  const [url, setUrl] = useState('');
  const [req, setReq] = useState('');
  return (
    <form
      className="hero"
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) onSubmit(url.trim(), req);
      }}
    >
      <div className="row">
        <label htmlFor="url">YouTube 视频链接</label>
        <input id="url" type="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} required />
      </div>
      <div className="row">
        <label htmlFor="req">生成要求(可选:任务类型 / 风格 / 受众 / 约束)</label>
        <textarea id="req" placeholder="例如:面向初学者,用轻松口吻,重点讲商业逻辑" value={req} onChange={(e) => setReq(e.target.value)} maxLength={500} />
      </div>
      <div className="hero-actions">
        <button className="primary" type="submit" disabled={disabled}>
          {disabled ? '生成中…' : '生成文章'}
        </button>
        <button className="chip" type="button" onClick={() => setUrl(SAMPLE)} disabled={disabled}>
          用演示视频试试
        </button>
      </div>
    </form>
  );
}
