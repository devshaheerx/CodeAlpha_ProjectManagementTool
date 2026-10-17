import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowLeft, Plus, Search, Settings, Users } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { idOf } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import Avatar, { AvatarStack } from '../components/Avatar';
import Spinner from '../components/Spinner';
import Column from '../components/Column';
import { TaskCardView } from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import MembersModal from '../components/MembersModal';
import CreateTaskModal from '../components/CreateTaskModal';
import ProjectFormModal from '../components/ProjectFormModal';
import { useConfirm } from '../context/ConfirmContext';

const byOrder = (a, b) => a.order - b.order;

export default function ProjectBoard() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState(null);
  const [role, setRole] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewers, setViewers] = useState([]);

  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [priority, setPriority] = useState('all');

  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState('');

  const [createIn, setCreateIn] = useState(null); // column id for the New task form, or null

  const [activeId, setActiveId] = useState(null);
  const dragSnapshot = useRef(null);
  const boardRef = useRef(null);

  const scrollToColumn = (columnId) => {
    boardRef.current
      ?.querySelector(`[data-column="${columnId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const selectedTaskId = searchParams.get('task');
  const canManage = ['owner', 'admin'].includes(role);

  /* ------------------------------ Loading ------------------------------ */

  const loadTasks = useCallback(async () => {
    const res = await api.get(`/projects/${projectId}/tasks`);
    setTasks(res.data.tasks);
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.get(`/projects/${projectId}`), api.get(`/projects/${projectId}/tasks`)])
      .then(([p, t]) => {
        if (!alive) return;
        setProject(p.data.project);
        setRole(p.data.role);
        setTasks(t.data.tasks);
      })
      .catch((err) => {
        toast.error(errMsg(err));
        navigate('/');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [projectId, navigate]);

  /* ----------------------------- Real-time ----------------------------- */

  useEffect(() => {
    if (!socket) return undefined;
    const join = () => socket.emit('project:join', projectId);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit('project:leave');
      setViewers([]);
    };
  }, [socket, projectId]);

  const applyProject = useCallback(
    (p) => {
      setProject(p);
      const me = p.members.find((m) => idOf(m.user) === user._id);
      if (me) setRole(me.role);
    },
    [user._id]
  );

  const applyMoves = useCallback((updates) => {
    const map = new Map(updates.map((u) => [idOf(u._id), u]));
    setTasks((prev) => prev.map((t) => (map.has(t._id) ? { ...t, column: map.get(t._id).column, order: map.get(t._id).order } : t)));
  }, []);

  const upsertTask = useCallback((task) => {
    setTasks((prev) => (prev.some((t) => t._id === task._id) ? prev.map((t) => (t._id === task._id ? task : t)) : [...prev, task]));
  }, []);

  useSocketEvent('task:created', useCallback(({ task }) => upsertTask(task), [upsertTask]));
  useSocketEvent('task:updated', useCallback(({ task }) => upsertTask(task), [upsertTask]));
  useSocketEvent(
    'task:deleted',
    useCallback(({ taskId }) => setTasks((prev) => prev.filter((t) => t._id !== idOf(taskId))), [])
  );
  useSocketEvent('tasks:moved', useCallback(({ updates }) => applyMoves(updates), [applyMoves]));
  useSocketEvent('tasks:refresh', useCallback(() => { loadTasks().catch(() => {}); }, [loadTasks]));
  useSocketEvent(
    'comment:created',
    useCallback(({ taskId, commentCount }) => {
      setTasks((prev) => prev.map((t) => (t._id === idOf(taskId) ? { ...t, commentCount } : t)));
    }, [])
  );
  useSocketEvent(
    'comment:deleted',
    useCallback(({ taskId, commentCount }) => {
      setTasks((prev) => prev.map((t) => (t._id === idOf(taskId) ? { ...t, commentCount } : t)));
    }, [])
  );
  useSocketEvent(
    'project:updated',
    useCallback(({ project: p }) => idOf(p._id) === projectId && applyProject(p), [projectId, applyProject])
  );
  useSocketEvent(
    'project:deleted',
    useCallback(
      ({ projectId: id, name }) => {
        if (idOf(id) !== projectId) return;
        toast(`"${name}" was deleted by its owner`);
        navigate('/');
      },
      [projectId, navigate]
    )
  );
  useSocketEvent(
    'project:removed',
    useCallback(
      ({ projectId: id, name, left }) => {
        if (idOf(id) !== projectId) return;
        if (!left) toast(`You were removed from "${name}"`); // leaving shows its own toast
        navigate('/');
      },
      [projectId, navigate]
    )
  );
  useSocketEvent(
    'presence',
    useCallback(({ projectId: id, users }) => idOf(id) === projectId && setViewers(users), [projectId])
  );

  /* ------------------------------ Derived ------------------------------ */

  const filtersActive = query.trim() !== '' || onlyMine || priority !== 'all';

  const tasksByColumn = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = {};
    project?.columns.forEach((c) => (map[c._id] = []));
    tasks.forEach((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return;
      if (onlyMine && !t.assignees.some((a) => idOf(a) === user._id)) return;
      if (priority !== 'all' && t.priority !== priority) return;
      (map[idOf(t.column)] ??= []).push(t);
    });
    Object.values(map).forEach((list) => list.sort(byOrder));
    return map;
  }, [tasks, project, query, onlyMine, priority, user._id]);

  const doneColumnId = project?.columns.at(-1)?._id;
  const selectedTask = tasks.find((t) => t._id === selectedTaskId);
  const activeTask = tasks.find((t) => t._id === activeId);

  /* ---------------------------- Task actions ---------------------------- */

  const openTask = (id) => setSearchParams(id ? { task: id } : {}, { replace: false });

  const addTask = async (columnId, title) => {
    try {
      const res = await api.post(`/projects/${projectId}/tasks`, { title, column: columnId });
      upsertTask(res.data.task);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const moveTask = async (taskId, columnId, index) => {
    const before = tasks;
    // Optimistic: put it where the user asked, renumber, then confirm with the server.
    setTasks((prev) => {
      const moving = prev.find((t) => t._id === taskId);
      if (!moving) return prev;
      const dest = prev.filter((t) => idOf(t.column) === columnId && t._id !== taskId).sort(byOrder);
      const at = index === undefined ? dest.length : Math.min(index, dest.length);
      dest.splice(at, 0, { ...moving, column: columnId });
      const orders = new Map(dest.map((t, i) => [t._id, i]));
      return prev.map((t) => (orders.has(t._id) ? { ...t, column: columnId, order: orders.get(t._id) } : t));
    });
    try {
      const res = await api.patch(`/tasks/${taskId}/move`, { column: columnId, ...(index !== undefined && { index }) });
      applyMoves(res.data.updates);
    } catch (err) {
      setTasks(before);
      toast.error(errMsg(err));
    }
  };

  /* ---------------------------- Drag and drop ---------------------------- */

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Phones: press and hold ~200ms to pick a card up, so normal swipes still scroll the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumn = (id) => {
    if (!id) return null;
    const sid = String(id);
    if (sid.startsWith('col:')) return sid.slice(4);
    const t = tasks.find((x) => x._id === sid);
    return t ? idOf(t.column) : null;
  };

  const onDragStart = ({ active }) => {
    setActiveId(active.id);
    dragSnapshot.current = tasks;
  };

  // Moving across columns: update local state live so the card "jumps" into the new column.
  const onDragOver = ({ active, over }) => {
    if (!over) return;
    const from = findColumn(active.id);
    const to = findColumn(over.id);
    if (!from || !to || from === to) return;

    setTasks((prev) => {
      const moving = prev.find((t) => t._id === active.id);
      if (!moving) return prev;
      const dest = prev.filter((t) => idOf(t.column) === to && t._id !== active.id).sort(byOrder);
      let idx = String(over.id).startsWith('col:') ? dest.length : dest.findIndex((t) => t._id === over.id);
      if (idx < 0) idx = dest.length;
      dest.splice(idx, 0, { ...moving, column: to });
      const orders = new Map(dest.map((t, i) => [t._id, i]));
      return prev.map((t) => (orders.has(t._id) ? { ...t, column: to, order: orders.get(t._id) } : t));
    });
  };

  const onDragEnd = async ({ active, over }) => {
    setActiveId(null);
    const snapshot = dragSnapshot.current;
    dragSnapshot.current = null;
    if (!over) {
      if (snapshot) setTasks(snapshot);
      return;
    }

    const column = findColumn(active.id);
    const list = tasks.filter((t) => idOf(t.column) === column).sort(byOrder);
    const oldIndex = list.findIndex((t) => t._id === active.id);
    let newIndex = oldIndex;
    if (!String(over.id).startsWith('col:')) {
      const overIndex = list.findIndex((t) => t._id === over.id);
      if (overIndex >= 0) newIndex = overIndex;
    }

    const reordered = arrayMove(list, oldIndex, newIndex);
    const orders = new Map(reordered.map((t, i) => [t._id, i]));
    setTasks((prev) => prev.map((t) => (orders.has(t._id) ? { ...t, order: orders.get(t._id) } : t)));

    const original = snapshot?.find((t) => t._id === active.id);
    const unchanged = original && idOf(original.column) === column && oldIndex === newIndex && original.order === newIndex;
    if (unchanged) return;

    try {
      const res = await api.patch(`/tasks/${active.id}/move`, { column, index: newIndex });
      applyMoves(res.data.updates);
    } catch (err) {
      toast.error(errMsg(err));
      loadTasks().catch(() => snapshot && setTasks(snapshot));
    }
  };

  const onDragCancel = () => {
    setActiveId(null);
    if (dragSnapshot.current) setTasks(dragSnapshot.current);
    dragSnapshot.current = null;
  };

  /* ---------------------------- Column actions ---------------------------- */

  const addColumn = async (e) => {
    e.preventDefault();
    const name = columnName.trim();
    if (!name) return;
    try {
      const res = await api.post(`/projects/${projectId}/columns`, { name });
      applyProject(res.data.project);
      setColumnName('');
      setAddingColumn(false);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const renameColumn = async (columnId, name) => {
    try {
      const res = await api.patch(`/projects/${projectId}/columns/${columnId}`, { name });
      applyProject(res.data.project);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const deleteColumn = async (column) => {
    // Explain up front instead of asking and then failing.
    const count = tasks.filter((t) => idOf(t.column) === column._id).length;
    if (count > 0) {
      toast.error(`Move or delete the ${count} task${count === 1 ? '' : 's'} in "${column.name}" first`);
      return;
    }
    if (project.columns.length <= 1) {
      toast.error('A board needs at least one column');
      return;
    }
    const ok = await confirm({
      title: `Delete "${column.name}" column?`,
      message: 'The column will be removed from the board for everyone.',
      confirmText: 'Delete column',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/projects/${projectId}/columns/${column._id}`);
      applyProject(res.data.project);
      toast.success(`Column "${column.name}" deleted`);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const deleteProject = async () => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      message: `This permanently deletes the project with all ${tasks.length} task${
        tasks.length === 1 ? '' : 's'
      } and their comments for every member. This can't be undone.`,
      confirmText: 'Delete project',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${projectId}`);
      setShowSettings(false);
      toast.success('Project deleted');
      navigate('/');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  /* -------------------------------- Render -------------------------------- */

  if (loading || !project) return <Spinner full />;

  const members = project.members.map((m) => m.user).filter(Boolean);
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => idOf(t.column) === doneColumnId).length;
  const otherViewers = viewers.filter((v) => v._id !== user._id);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden">
      <div className="border-b border-zinc-200 bg-white px-3 py-3 sm:px-6 sm:py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/" className="btn btn-ghost -ml-1 shrink-0 p-2" aria-label="Back to dashboard">
              <ArrowLeft size={18} />
            </Link>
            <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{project.name}</h1>
              <p className="truncate text-xs text-zinc-500">
                {doneTasks}/{totalTasks} done
                <span className="hidden md:inline">{project.description ? ` · ${project.description}` : ''}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {otherViewers.length > 0 && (
              <div
                className="flex items-center gap-2 rounded-full bg-emerald-50 py-1 pr-1 pl-1 sm:pr-3 dark:bg-emerald-500/10"
                title={`${otherViewers.map((v) => v.name).join(', ')} viewing now`}
              >
                <div className="flex -space-x-1.5">
                  {otherViewers.slice(0, 3).map((v) => (
                    <Avatar key={v._id} user={v} size="sm" ring />
                  ))}
                </div>
                <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-700 sm:flex dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  {otherViewers.length} viewing
                </span>
              </div>
            )}
            <button onClick={() => setShowMembers(true)} className="btn btn-secondary px-2 sm:px-3.5" aria-label="Members">
              <span className="hidden sm:block">
                <AvatarStack users={members} max={3} size="xs" />
              </span>
              <Users size={16} /> <span className="hidden lg:inline">Members</span>
              <span className="text-xs text-zinc-500 sm:hidden">{members.length}</span>
            </button>
            {canManage && (
              <button onClick={() => setShowSettings(true)} className="btn btn-secondary p-2" aria-label="Project settings">
                <Settings size={16} />
              </button>
            )}
            <button onClick={() => setCreateIn(project.columns[0]?._id)} className="btn btn-primary hidden sm:inline-flex">
              <Plus size={16} /> New task
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              className="input pl-9"
              type="search"
              placeholder="Search tasks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tasks"
            />
          </div>
          <select
            className="input w-auto min-w-0 flex-1 sm:flex-none"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={`btn flex-1 whitespace-nowrap sm:flex-none ${onlyMine ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={onlyMine}
          >
            Assigned to me
          </button>
          {filtersActive && (
            <>
              <button
                onClick={() => {
                  setQuery('');
                  setOnlyMine(false);
                  setPriority('all');
                }}
                className="btn btn-ghost"
              >
                Clear
              </button>
              <span className="w-full text-xs text-zinc-500 sm:w-auto">Dragging is paused while filters are on.</span>
            </>
          )}
        </div>
      </div>

      {/* Phones: jump between columns (the board scrolls sideways one column at a time). */}
      <nav className="scroll-thin flex gap-1.5 overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 md:hidden dark:border-zinc-800 dark:bg-zinc-950" aria-label="Columns">
        {project.columns.map((c) => (
          <button
            key={c._id}
            onClick={() => scrollToColumn(c._id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
          >
            {c.name}
            <span className="text-zinc-400 tabular-nums">{tasksByColumn[c._id]?.length ?? 0}</span>
          </button>
        ))}
      </nav>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          ref={boardRef}
          className="scroll-thin flex-1 snap-x snap-proximity overflow-x-auto scroll-px-3 md:min-h-0 md:snap-none"
        >
          <div className="flex min-h-[60dvh] w-max items-start gap-3 p-3 pb-24 sm:gap-4 sm:px-6 sm:py-4 md:h-full md:min-h-0">
            {project.columns.map((column) => (
              <Column
                key={column._id}
                column={column}
                tasks={tasksByColumn[column._id] ?? []}
                isDone={column._id === doneColumnId && project.columns.length > 1}
                canManage={canManage}
                dndDisabled={filtersActive}
                onOpenTask={openTask}
                onAddTask={addTask}
                onNewTask={setCreateIn}
                onRename={renameColumn}
                onDelete={deleteColumn}
              />
            ))}

            {canManage && (
              <div className="w-[82vw] max-w-[300px] shrink-0 snap-start sm:w-[290px]">
                {addingColumn ? (
                  <form onSubmit={addColumn} className="card space-y-2 p-3">
                    <input
                      autoFocus
                      className="input"
                      placeholder="Column name"
                      maxLength={40}
                      value={columnName}
                      onChange={(e) => setColumnName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setAddingColumn(false)}
                    />
                    <div className="flex gap-2">
                      <button className="btn btn-primary py-1.5" disabled={!columnName.trim()}>Add column</button>
                      <button type="button" onClick={() => setAddingColumn(false)} className="btn btn-ghost py-1.5">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 py-3 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
                  >
                    <Plus size={16} /> Add column
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-[min(274px,calc(82vw-16px))]">
              <TaskCardView task={activeTask} isDone={idOf(activeTask.column) === doneColumnId} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Phones: floating "New task" button */}
      <button
        onClick={() => setCreateIn(project.columns[0]?._id)}
        className="btn btn-primary fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 h-14 w-14 rounded-full p-0 shadow-lg sm:hidden"
        aria-label="New task"
      >
        <Plus size={24} />
      </button>

      <CreateTaskModal
        open={Boolean(createIn)}
        onClose={() => setCreateIn(null)}
        project={project}
        defaultColumn={createIn}
        onCreated={upsertTask}
      />

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          project={project}
          role={role}
          onClose={() => openTask(null)}
          onUpdated={upsertTask}
          onDeleted={(id) => {
            setTasks((prev) => prev.filter((t) => t._id !== id));
            openTask(null);
          }}
          onMove={(id, columnId) => idOf(selectedTask.column) !== columnId && moveTask(id, columnId)}
        />
      )}

      <MembersModal
        open={showMembers}
        onClose={() => setShowMembers(false)}
        project={project}
        role={role}
        onProjectChange={(p) => {
          applyProject(p);
          loadTasks().catch(() => {});
        }}
        onLeft={() => {
          toast.success(`You left "${project.name}"`);
          navigate('/');
        }}
      />

      <ProjectFormModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        project={project}
        onSaved={applyProject}
        canDelete={role === 'owner'}
        onDelete={deleteProject}
      />
    </div>
  );
}
