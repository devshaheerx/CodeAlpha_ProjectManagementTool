import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, CheckCircle2, FolderKanban, ListTodo, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { DUE_STYLES, PRIORITIES, dueStatus, formatDue, greeting } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import { AvatarStack } from '../components/Avatar';
import Spinner from '../components/Spinner';
import ProjectFormModal from '../components/ProjectFormModal';

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="card flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${tone}`}>
        <Icon size={20} />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs leading-tight text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  const { total, done } = project.stats;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const members = project.members.map((m) => m.user).filter(Boolean);
  return (
    <Link
      to={`/projects/${project._id}`}
      className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="h-1.5" style={{ backgroundColor: project.color }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{project.name}</h3>
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 capitalize dark:bg-zinc-800 dark:text-zinc-300">
            {project.role}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm text-zinc-500">{project.description || 'No description'}</p>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
            <span>{done}/{total} tasks done</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: project.color }} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <AvatarStack users={members} />
          <span className="text-xs text-zinc-500">{members.length} member{members.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  );
}

function MyTaskRow({ task }) {
  const navigate = useNavigate();
  const status = dueStatus(task.dueDate, task.isDone);
  return (
    <li>
      <button
        onClick={() => navigate(`/projects/${task.project._id}?task=${task._id}`)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        {task.isDone ? (
          <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
        ) : (
          <span className="h-4 w-4 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
        )}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${task.isDone ? 'text-zinc-400 line-through' : ''}`}>{task.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.project.color }} />
            <span className="truncate">{task.project.name}</span>
            <span>·</span>
            <span className="shrink-0">{task.columnName}</span>
          </span>
        </span>
        <span className="hidden flex-col items-end gap-1 sm:flex">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITIES[task.priority].className}`}>
            {PRIORITIES[task.priority].label}
          </span>
          {task.dueDate && (
            <span className={`text-xs ${status ? DUE_STYLES[status] : 'text-zinc-400'}`}>{formatDue(task.dueDate)}</span>
          )}
        </span>
      </button>
    </li>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api.get('/projects'), api.get('/tasks/mine')]);
      setProjects(p.data.projects);
      setTasks(t.data.tasks);
    } catch {
      setProjects((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Someone added me to a project, removed me, or assigned me something.
  useSocketEvent('project:added', load);
  useSocketEvent('project:removed', load);
  useSocketEvent('notification:new', load);

  const stats = useMemo(() => {
    const open = tasks.filter((t) => !t.isDone);
    return {
      open: open.length,
      overdue: open.filter((t) => dueStatus(t.dueDate) === 'overdue').length,
      dueSoon: open.filter((t) => ['today', 'soon'].includes(dueStatus(t.dueDate))).length,
    };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const list = showDone ? tasks : tasks.filter((t) => !t.isDone);
    return [...list].sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [tasks, showDone]);

  if (projects === null) return <Spinner full />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Here's what's happening across your projects.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-primary">
          <Plus size={16} /> New project
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={projects.length} tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" />
        <StatCard icon={ListTodo} label="Open tasks assigned to you" value={stats.open} tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" />
        <StatCard icon={CalendarClock} label="Due in the next 3 days" value={stats.dueSoon} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" />
        <StatCard icon={AlertCircle} label="Overdue" value={stats.overdue} tone="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-500">Your projects</h2>
          {projects.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <FolderKanban size={32} className="text-zinc-400" />
              <p className="mt-3 font-medium">No projects yet</p>
              <p className="mt-1 max-w-xs text-sm text-zinc-500">Create your first project, then invite teammates by email to start assigning tasks.</p>
              <button onClick={() => setShowNew(true)} className="btn btn-primary mt-5">
                <Plus size={16} /> Create a project
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <ProjectCard key={p._id} project={p} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-500">Assigned to you</h2>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-indigo-600" />
              Show completed
            </label>
          </div>
          <div className="card overflow-hidden">
            {visibleTasks.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-500">Nothing assigned to you right now.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visibleTasks.map((t) => (
                  <MyTaskRow key={t._id} task={t} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <ProjectFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSaved={(p) => navigate(`/projects/${p._id}`)}
      />
    </div>
  );
}
