export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="error-card" role="alert">
      {message}
    </div>
  );
}
