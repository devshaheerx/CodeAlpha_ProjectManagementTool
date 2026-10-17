export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <circle cx="16" cy="16" r="5" fill="#fff" />
      <ellipse cx="16" cy="16" rx="11" ry="5" fill="none" stroke="#c7d2fe" strokeWidth="2" transform="rotate(-30 16 16)" />
    </svg>
  );
}
