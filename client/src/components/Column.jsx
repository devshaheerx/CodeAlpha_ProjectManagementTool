import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import SortableTaskCard from './TaskCard';

function ColumnMenu({ onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost p-1" aria-label="Column options">
        <Ellipsis size={16} />
      </button>
      {open && (
        <div className="card absolute right-0 z-20 mt-1 w-40 p-1 shadow-lg">
          <button onClick={() => { setOpen(false); onRename(); }} className="btn btn-ghost w-full justify-start">
            <Pencil size={14} /> Rename
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="btn btn-ghost w-full justify-start text-red-600 dark:text-red-400"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function Column({
  column,
  tasks,
  isDone,
  canManage,
  dndDisabled,
  onOpenTask,
  onAddTask,
  onNewTask,
  onRename,
  onDelete,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column._id}`, data: { type: 'column' } });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);

  useEffect(() => setName(column.name), [column.name]);

  const submitTask = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle('');
    await onAddTask(column._id, t);
  };

  const submitRename = async (e) => {
    e?.preventDefault();
    setRenaming(false);
    const n = name.trim();
    if (n && n !== column.name) await onRename(column._id, n);
    else setName(column.name);
  };

  return (
    <div
      data-column={column._id}
      className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl bg-zinc-100/80 sm:w-[290px] md:max-h-full dark:bg-zinc-900/60"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        {renaming ? (
          <form onSubmit={submitRename} className="flex-1">
            <input
              autoFocus
              className="input py-1"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => e.key === 'Escape' && (setName(column.name), setRenaming(false))}
            />
          </form>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            {isDone && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Tasks here count as done" />}
            <h3 className="truncate text-sm font-semibold">{column.name}</h3>
            <span className="rounded-full bg-zinc-200 px-1.5 text-xs font-medium text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-400">
              {tasks.length}
            </span>
          </div>
        )}
        {!renaming && (
          <div className="flex shrink-0 items-center">
            <button
              onClick={() => onNewTask(column._id)}
              className="btn btn-ghost p-1"
              aria-label={`New task in ${column.name}`}
              title="New task with details"
            >
              <Plus size={16} />
            </button>
            {canManage && <ColumnMenu onRename={() => setRenaming(true)} onDelete={() => onDelete(column)} />}
          </div>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`scroll-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors ${
          isOver ? 'rounded-lg bg-indigo-50/70 dark:bg-indigo-500/5' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task._id} task={task} isDone={isDone} onOpen={onOpenTask} disabled={dndDisabled} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed border-zinc-300 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700">
            Drop tasks here
          </p>
        )}
      </div>

      <div className="px-2 pb-2">
        {adding ? (
          <form onSubmit={submitTask} className="space-y-2">
            <textarea
              autoFocus
              rows={2}
              className="input resize-none"
              placeholder="Task title"
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) submitTask(e);
                if (e.key === 'Escape') setAdding(false);
              }}
            />
            <div className="flex gap-2">
              <button className="btn btn-primary py-1.5" disabled={!title.trim()}>Add task</button>
              <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost py-1.5">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="btn btn-ghost w-full justify-start py-1.5 text-zinc-500">
            <Plus size={16} /> Add task
          </button>
        )}
      </div>
    </div>
  );
}
