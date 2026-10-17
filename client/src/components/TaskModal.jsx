import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Send, Trash2, X } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import Spinner from './Spinner';
import AssigneePicker from './AssigneePicker';
import { api, errMsg } from '../lib/api';
import { PRIORITIES, idOf, timeAgo, toDateInput } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { useConfirm } from '../context/ConfirmContext';

/* ------------------------- Comment thread (live) ------------------------- */

function Comments({ task, canModerate, onCountChange }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const socket = useSocket();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typers, setTypers] = useState({}); // userId -> { name, timer }
  const endRef = useRef(null);
  const typingSent = useRef(false);
  const stopTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    setComments(null);
    api
      .get(`/tasks/${task._id}/comments`)
      .then((res) => alive && setComments(res.data.comments))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [task._id]);

  // Scroll to the newest comment only when one arrives, not when the thread first loads.
  const prevCount = useRef(null);
  useEffect(() => {
    if (comments === null) {
      prevCount.current = null; // switching tasks: next load is a first load again
      return;
    }
    if (prevCount.current !== null && comments.length > prevCount.current) {
      endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    prevCount.current = comments.length;
  }, [comments]);

  const onCreated = useCallback(
    ({ comment, taskId }) => {
      if (idOf(taskId) !== task._id) return;
      setComments((prev) => (prev && !prev.some((c) => c._id === comment._id) ? [...prev, comment] : prev));
      // The author stopped typing once their comment landed.
      setTypers((prev) => {
        const next = { ...prev };
        delete next[idOf(comment.author)];
        return next;
      });
    },
    [task._id]
  );
  const onDeleted = useCallback(
    ({ commentId, taskId }) => {
      if (idOf(taskId) !== task._id) return;
      setComments((prev) => prev?.filter((c) => c._id !== idOf(commentId)));
    },
    [task._id]
  );
  const onTyping = useCallback(
    ({ taskId, user: who, typing }) => {
      if (idOf(taskId) !== task._id || who._id === user._id) return;
      setTypers((prev) => {
        const next = { ...prev };
        clearTimeout(next[who._id]?.timer);
        if (typing) {
          // Safety net in case the "stopped" event never arrives.
          const timer = setTimeout(() => setTypers((p) => {
            const n = { ...p };
            delete n[who._id];
            return n;
          }), 5000);
          next[who._id] = { name: who.name.split(' ')[0], timer };
        } else {
          delete next[who._id];
        }
        return next;
      });
    },
    [task._id, user._id]
  );
  useSocketEvent('comment:created', onCreated);
  useSocketEvent('comment:deleted', onDeleted);
  useSocketEvent('comment:typing', onTyping);

  const emitTyping = useCallback(
    (typing) => {
      if (!socket || typingSent.current === typing) return;
      typingSent.current = typing;
      socket.emit('comment:typing', { taskId: task._id, typing });
    },
    [socket, task._id]
  );

  // Stop the indicator when the modal closes.
  useEffect(() => () => {
    clearTimeout(stopTimer.current);
    emitTyping(false);
  }, [emitTyping]);

  const onChange = (e) => {
    setText(e.target.value);
    emitTyping(e.target.value.trim().length > 0);
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => emitTyping(false), 2500);
  };

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/tasks/${task._id}/comments`, { text: t });
      setComments((prev) => [...(prev ?? []), res.data.comment]);
      onCountChange(res.data.commentCount);
      setText('');
      emitTyping(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async (c) => {
    const ok = await confirm({
      title: 'Delete comment?',
      message: idOf(c.author) === user._id ? 'Your comment will be removed for everyone.' : `${c.author?.name}'s comment will be removed for everyone.`,
      confirmText: 'Delete',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/comments/${c._id}`);
      setComments((prev) => prev.filter((x) => x._id !== c._id));
      onCountChange(res.data.commentCount);
      toast.success('Comment deleted');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const typingNames = Object.values(typers).map((t) => t.name);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">
        Comments {comments?.length ? <span className="text-zinc-400">({comments.length})</span> : null}
      </h3>
      {comments === null ? (
        <Spinner className="my-4" />
      ) : (
        <ul className="space-y-4">
          {comments.length === 0 && <li className="text-sm text-zinc-500">No comments yet. Start the conversation.</li>}
          {comments.map((c) => (
            <li key={c._id} className="group flex gap-3">
              <Avatar user={c.author} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{c.author?.name}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{timeAgo(c.createdAt)}</span>
                  {(idOf(c.author) === user._id || canModerate) && (
                    <button
                      onClick={() => remove(c)}
                      className="ml-auto p-1 text-zinc-400 transition-opacity hover:text-red-500 focus:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                      aria-label="Delete comment"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{c.text}</p>
              </div>
            </li>
          ))}
          <div ref={endRef} />
        </ul>
      )}

      <p className="mt-3 h-5 text-xs text-zinc-500" aria-live="polite">
        {typingNames.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400" />
            </span>
            {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
          </span>
        )}
      </p>

      <form onSubmit={send} className="mt-1 flex items-end gap-2">
        <Avatar user={user} size="md" className="hidden sm:inline-flex" />
        <textarea
          rows={1}
          className="input min-h-10 flex-1 resize-none [field-sizing:content] max-h-40"
          placeholder="Write a comment…"
          maxLength={2000}
          value={text}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          aria-label="Write a comment"
        />
        <button className="btn btn-primary h-10 shrink-0 px-3" disabled={sending || !text.trim()} aria-label="Send comment">
          <Send size={16} />
        </button>
      </form>
      <p className="mt-1.5 hidden text-[11px] text-zinc-400 sm:block">Enter to send · Shift + Enter for a new line</p>
    </div>
  );
}

/* ------------------------------- Task modal ------------------------------- */

export default function TaskModal({ task, project, role, onClose, onUpdated, onDeleted, onMove }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [editingDesc, setEditingDesc] = useState(false);

  // Keep local fields in sync when someone else edits the task live.
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => {
    if (!editingDesc) setDescription(task.description || '');
  }, [task.description, editingDesc]);

  const save = async (patch) => {
    try {
      const res = await api.patch(`/tasks/${task._id}`, patch);
      onUpdated(res.data.task);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) save({ title: t });
  };

  const saveDescription = async () => {
    setEditingDesc(false);
    if (description.trim() !== (task.description || '')) await save({ description });
  };

  const remove = async () => {
    const n = task.commentCount || 0;
    const ok = await confirm({
      title: 'Delete this task?',
      message: `"${task.title}"${n ? ` and its ${n} comment${n === 1 ? '' : 's'}` : ''} will be permanently deleted for everyone on the board.`,
      confirmText: 'Delete task',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/tasks/${task._id}`);
      toast.success('Task deleted');
      onDeleted(task._id);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const canDelete = ['owner', 'admin'].includes(role) || idOf(task.createdBy) === user._id;
  const canModerate = ['owner', 'admin'].includes(role);
  const columnName = project.columns.find((c) => c._id === idOf(task.column))?.name;

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="-mt-1 mb-1 flex items-start gap-2 sm:gap-3">
        <span className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
        <textarea
          rows={1}
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
          className="-mx-1 min-w-0 flex-1 resize-none rounded-md bg-transparent px-1 py-1 text-base font-semibold [field-sizing:content] hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none sm:text-lg dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
          aria-label="Task title"
        />
        <button onClick={onClose} className="btn btn-ghost -mr-2 shrink-0 p-1.5" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <p className="mb-5 pl-5 text-xs text-zinc-500 sm:pl-6">
        in <span className="font-medium text-zinc-700 dark:text-zinc-300">{columnName}</span> · {project.name}
      </p>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_230px]">
        {/* On phones the details panel comes first so status/assignees are reachable without scrolling past comments. */}
        <aside className="order-first space-y-4 md:order-last md:border-l md:border-zinc-200 md:pl-6 md:dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <div>
              <label className="label" htmlFor="t-col">Status</label>
              <select id="t-col" className="input" value={idOf(task.column)} onChange={(e) => onMove(task._id, e.target.value)}>
                {project.columns.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-pri">Priority</label>
              <select id="t-pri" className="input" value={task.priority} onChange={(e) => save({ priority: e.target.value })}>
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="t-due">Due date</label>
            <div className="flex gap-1">
              <input
                id="t-due"
                type="date"
                className="input"
                value={toDateInput(task.dueDate)}
                onChange={(e) => save({ dueDate: e.target.value || null })}
              />
              {task.dueDate && (
                <button onClick={() => save({ dueDate: null })} className="btn btn-ghost shrink-0 px-2" aria-label="Clear due date">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div>
            <span className="label">Assignees</span>
            <AssigneePicker
              members={project.members.filter((m) => m.user)}
              selected={task.assignees}
              onChange={(ids) => save({ assignees: ids })}
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-zinc-200 pt-4 md:block md:space-y-3 dark:border-zinc-800">
            <div className="space-y-0.5 text-xs text-zinc-500">
              <p>Created by {task.createdBy?.name ?? 'someone'}</p>
              <p>{new Date(task.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            {canDelete && (
              <button
                onClick={remove}
                className="btn shrink-0 text-red-600 hover:bg-red-50 md:w-full dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 size={16} /> Delete task
              </button>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Description</h3>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  className="input min-h-32 resize-y"
                  maxLength={5000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details, acceptance criteria, links…"
                />
                <div className="flex gap-2">
                  <button onClick={saveDescription} className="btn btn-primary py-1.5">Save</button>
                  <button
                    onClick={() => {
                      setDescription(task.description || '');
                      setEditingDesc(false);
                    }}
                    className="btn btn-ghost py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingDesc(true)}
                className="block min-h-16 w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm break-words whitespace-pre-wrap hover:bg-zinc-50 sm:border-transparent sm:hover:border-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800/50 sm:dark:border-transparent sm:dark:hover:border-zinc-800"
              >
                {task.description || <span className="text-zinc-400">Add a description…</span>}
              </button>
            )}
          </div>

          <div className="border-t border-zinc-200 pt-5 md:border-0 md:pt-0 dark:border-zinc-800">
            <Comments task={task} canModerate={canModerate} onCountChange={(n) => onUpdated({ ...task, commentCount: n })} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
