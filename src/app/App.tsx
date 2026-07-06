import { useGeneration } from './hooks/useGeneration';
import { HeroForm } from './components/HeroForm';
import { StatusBar } from './components/StatusBar';
import { Article } from './components/Article';
import { ErrorCard } from './components/ErrorCard';
import { Footer } from './components/Footer';

export function App() {
  const { state, generate, requestWH } = useGeneration();
  const busy = state.status === 'fetching' || state.status === 'streaming';

  return (
    <main className="app">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Retell</h1>
        </div>
        <p>
          把有字幕的 YouTube 视频,转述成一篇排版清晰的<em>中文文章</em>。
        </p>
      </header>

      <HeroForm onSubmit={generate} disabled={busy} />

      {state.meta && <StatusBar meta={state.meta} status={state.status} />}
      {state.status === 'error' && state.error && <ErrorCard message={state.error} />}
      {state.article && (
        <Article
          article={state.article}
          canWH={state.status === 'done'}
          streaming={state.status === 'streaming'}
          whByChapter={state.whByChapter}
          onRequestWH={requestWH}
        />
      )}

      <Footer />
    </main>
  );
}
