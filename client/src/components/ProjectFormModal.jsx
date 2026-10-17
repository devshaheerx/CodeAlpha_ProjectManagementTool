import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { api, errMsg } from '../lib/api';
import { PROJECT_COLORS } from '../lib/utils';

/** Create a project (no `project` prop) or edit one. */
export default function ProjectFormModal({ open, onClose, project, onSaved, onDelete, canDelete }) {
  const editing = Boolean(project);
  const [form, setForm] = useState({ name: '', description: '', color: PROJECT_COLORS[0] });
  const [emails, setEmails] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmails('');
    setForm(
      project
        ? { name: project.name, description: project.description || '', color: project.color }
        : { name: '', description: '', color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)] }
    );
  }, [open, project]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const memberEmails = emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
      const res = editing
        ? await api.patch(`/projects/${project._id}`, form)
        : await api.post('/projects', { ...form, memberEmails });
      toast.success(editing ? 'Project updated' : 'Project created');
      if (res.data.notFound?.length) {
        toast(`No account found for: ${res.data.notFound.join(', ')}. Ask them to sign up, then add them from Members.`, {
          duration: 6000,
        });
      }
      onSaved?.(res.data.project);
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Project settings' : 'New project'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="pname">Name</label>
          <input
            id="pname"
            className="input"
            autoFocus
            maxLength={80}
            placeholder="e.g. Website Relaunch"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="pdesc">Description</label>
          <textarea
            id="pdesc"
            className="input min-h-20 resize-y"
            maxLength={500}
            placeholder="What is this project about?"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                aria-pressed={form.color === c}
              >
                {form.color === c && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>
        {!editing && (
          <div>
            <label className="label" htmlFor="pemails">Invite teammates (optional)</label>
            <textarea
              id="pemails"
              rows={2}
              className="input resize-none"
              placeholder="ayesha@demo.com, bilal@demo.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Separate emails with commas. The board starts with To Do, In Progress, Review and Done columns.
            </p>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {editing && canDelete ? (
            <button type="button" onClick={onDelete} className="btn text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
              Delete project
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1 sm:flex-none">Cancel</button>
            <button className="btn btn-primary flex-1 sm:flex-none" disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
