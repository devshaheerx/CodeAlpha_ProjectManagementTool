import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/utils';
import { useSocketEvent } from '../context/SocketContext';
import Avatar from './Avatar';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications').then((res) => {
      setItems(res.data.notifications);
      setUnread(res.data.unread);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onNew = useCallback((n) => {
    setItems((prev) => [n, ...prev.filter((x) => x._id !== n._id)].slice(0, 30));
    setUnread((u) => u + 1);
    toast(n.message, {
      icon: (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
          <Bell size={14} />
        </span>
      ),
    });
  }, []);
  useSocketEvent('notification:new', onNew);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.patch(`/notifications/${n._id}/read`).catch(() => {});
    }
    if (n.project?._id) navigate(`/projects/${n.project._id}${n.task ? `?task=${n.task}` : ''}`);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    api.patch('/notifications/read-all').catch(() => {});
  };

  const clearAll = async () => {
    setItems([]);
    setUnread(0);
    api.delete('/notifications').catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost relative p-2" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card fixed inset-x-3 top-16 z-40 overflow-hidden shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[22rem]">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex gap-1">
              <button onClick={markAll} className="btn btn-ghost p-1.5" title="Mark all as read" aria-label="Mark all as read">
                <CheckCheck size={16} />
              </button>
              <button onClick={clearAll} className="btn btn-ghost p-1.5" title="Clear all" aria-label="Clear all">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <ul className="scroll-thin max-h-[min(24rem,calc(100dvh-9rem))] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-zinc-500">You're all caught up.</li>}
            {items.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                    n.read ? '' : 'bg-indigo-50/60 dark:bg-indigo-500/5'
                  }`}
                >
                  <Avatar user={n.actor} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm">{n.message}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {n.project?.name && <>{n.project.name} · </>}
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
