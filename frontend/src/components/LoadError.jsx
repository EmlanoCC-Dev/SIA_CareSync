export default function LoadError({ message, onRetry, loading }) {
  if (!message) return null;
  return (
    <div className="alert alert-error load-error" role="alert">
      <span>{message} Any previously loaded data may be out of date.</span>
      <button className="btn btn-secondary btn-sm" onClick={onRetry} disabled={loading}>Retry</button>
    </div>
  );
}
