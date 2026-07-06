export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="error-card" role="alert">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v3.5" />
        <path d="M8 11h.01" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
