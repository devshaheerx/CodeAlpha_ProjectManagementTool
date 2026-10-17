import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MessageSquare } from 'lucide-react';
import { AvatarStack } from './Avatar';
import { DUE_STYLES, PRIORITIES, dueStatus, formatDue } from '../lib/utils';

export function TaskCardView({ task, isDone, overlay = false, onClick }) {
  const status = dueStatus(task.dueDate, isDone);
  const priority = PRIORITIES[task.priority] ?? PRIORITIES.medium;

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 shadow-xs transition-shadow hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 ${
        overlay ? 'rotate-2 shadow-lg ring-2 ring-indigo-500/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm leading-snug font-medium ${isDone ? 'text-zinc-400 line-through' : ''}`}>{task.title}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${priority.className}`}>{priority.label}</span>
        {task.dueDate && (
          <span className={`flex items-center gap-1 text-xs ${status ? DUE_STYLES[status] : 'text-zinc-400'}`}>
            <Calendar size={12} />
            {formatDue(task.dueDate)}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <MessageSquare size={12} />
            {task.commentCount}
          </span>
        )}
        <span className="ml-auto">
          <AvatarStack users={task.assignees} max={3} size="xs" />
        </span>
      </div>
    </div>
  );
}

export default function SortableTaskCard({ task, isDone, onOpen, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    data: { type: 'task' },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-manipulation outline-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <TaskCardView task={task} isDone={isDone} onClick={() => onOpen(task._id)} />
    </div>
  );
}
