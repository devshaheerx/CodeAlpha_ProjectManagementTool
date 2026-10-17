import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-zinc-500">The page you're looking for doesn't exist or was moved.</p>
      <Link to="/" className="btn btn-primary mt-3">Back to dashboard</Link>
    </div>
  );
}
