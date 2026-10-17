import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import AssigneePicker from './AssigneePicker';
import { api, errMsg } from '../lib/api';
import { PRIORITIES } from '../lib/utils';

const EMPTY = { title: '', description: '', priority: 'medium', dueDate: '', assignees: [] };

export default function CreateTaskModal({ open, onClose, project, defaultColumn, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [column, setColumn] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setColumn(defaultColumn || project.columns[0]?._id || '');
  }, [open, defaultColumn, project.columns]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/projects/${project._id}/tasks`, {
        ...form,
        title: form.title.trim(),
        column,
        dueDate: form.dueDate || null,
      });
      onCreated(res.data.task);
      toast.success(form.assignees.length ? 'Task created and assignees notified' : 'Task created');
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New task" size="lg">
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="nt-title">Title</label>
            <input
              id="nt-title"
              autoFocus
              className="input"
              maxLength={150}
              placeholder="What needs to be done?"
              value={form.title}
              onChange={set('title')}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="nt-desc">Description</label>
            <textarea
              id="nt-desc"
              className="input min-h-28 resize-y md:min-h-44"
              maxLength={5000}
              placeholder="Add details, acceptance criteria, links…"
              value={form.description}
              onChange={set('description')}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <div>
              <label className="label" htmlFor="nt-col">Status</label>
              <select id="nt-col" className="input" value={column} onChange={(e) => setColumn(e.target.value)}>
                {project.columns.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nt-pri">Priority</label>
              <select id="nt-pri" className="input" value={form.priority} onChange={set('priority')}>
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="nt-due">Due date</label>
            <input id="nt-due" type="date" className="input" value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <div>
            <span className="label">Assign to</span>
            <div className="scroll-thin max-h-48 overflow-y-auto">
              <AssigneePicker
                members={project.members.filter((m) => m.user)}
                selected={form.assignees}
                onChange={(ids) => setForm({ ...form, assignees: ids })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-zinc-200 pt-4 md:col-span-2 md:justify-end dark:border-zinc-800">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1 md:flex-none">Cancel</button>
          <button className="btn btn-primary flex-1 md:flex-none" disabled={saving || !form.title.trim()}>
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
