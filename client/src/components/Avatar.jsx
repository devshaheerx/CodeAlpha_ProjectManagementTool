const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const initials = (name = '?') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export default function Avatar({ user, size = 'md', ring = false, className = '' }) {
  return (
    <span
      title={user?.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZES[size]} ${
        ring ? 'ring-2 ring-white dark:ring-zinc-900' : ''
      } ${className}`}
      style={{ backgroundColor: user?.avatarColor || '#71717a' }}
    >
      {initials(user?.name)}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = 'sm' }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((u) => (
        <Avatar key={u._id} user={u} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-900 ${SIZES[size]}`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
