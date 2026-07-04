import { WH_KEYS, WH_LABELS } from '../../shared/protocol';
import type { WHState } from '../hooks/useGeneration';

export function WHPanel({ state }: { state: WHState }) {
  if (state.status === 'loading') {
    return (
      <dl className="wh-panel" aria-busy="true">
        {WH_KEYS.map((k) => (
          <div className="wh-row" key={k}>
            <dt>{WH_LABELS[k]}</dt>
            <dd>
              <div className="wh-skeleton" />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="wh-panel" role="alert" style={{ color: 'var(--danger)' }}>
        {state.message}
      </div>
    );
  }
  return (
    <dl className="wh-panel">
      {WH_KEYS.map((k) => (
        <div className="wh-row" key={k}>
          <dt>{WH_LABELS[k]}</dt>
          <dd>{state.data[k]}</dd>
        </div>
      ))}
    </dl>
  );
}
