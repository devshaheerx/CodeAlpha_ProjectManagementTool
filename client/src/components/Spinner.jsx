export default function Spinner({ full = false, className = '' }) {
  const ring = (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
  if (!full) return ring;
  return <div className="flex min-h-[60vh] items-center justify-center">{ring}</div>;
}
