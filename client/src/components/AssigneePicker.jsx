import { Check } from 'lucide-react';
import Avatar from './Avatar';
import { idOf } from '../lib/utils';

/** Toggle list of project members. `selected` may be user objects or ids. */
export default function AssigneePicker({ members, selected, onChange }) {
  const selectedIds = new Set(selected.map(idOf));
  const toggle = (id) => {
    const next = selectedIds.has(id) ? [...selectedIds].filter((x) => x !== id) : [...selectedIds, id];
    onChange(next);
  };
  return (
    <div className="space-y-1">
      {members.map(({ user }) => {
        const on = selectedIds.has(user._id);
        return (
          <button
            type="button"
            key={user._id}
            onClick={() => toggle(user._id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors sm:py-1.5 ${
              on ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            aria-pressed={on}
          >
            <Avatar user={user} size="sm" />
            <span className="min-w-0 flex-1 truncate">{user.name}</span>
            {on && <Check size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />}
          </button>
        );
      })}
    </div>
  );
}
