import { useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const ROLE_STYLES = {
  owner: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  member: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

export default function MembersModal({ open, onClose, project, role, onProjectChange, onLeft }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [busy, setBusy] = useState(false);

  const canInvite = ['owner', 'admin'].includes(role);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await api.post(`/projects/${project._id}/members`, { email: email.trim(), role: newRole });
      onProjectChange(res.data.project);
      toast.success('Member added');
      setEmail('');
      setNewRole('member');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId, r) => {
    try {
      const res = await api.patch(`/projects/${project._id}/members/${userId}`, { role: r });
      onProjectChange(res.data.project);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (member) => {
    const self = member.user._id === user._id;
    const msg = self ? `Leave "${project.name}"?` : `Remove ${member.user.name} from this project? They'll be unassigned from its tasks.`;
    if (!window.confirm(msg)) return;
    try {
      const res = await api.delete(`/projects/${project._id}/members/${member.user._id}`);
      if (self) onLeft();
      else {
        onProjectChange(res.data.project);
        toast.success('Member removed');
      }
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const canRemove = (m) => {
    if (m.role === 'owner') return false;
    if (m.user._id === user._id) return true; // leave
    if (role === 'owner') return true;
    return role === 'admin' && m.role === 'member';
  };

  return (
    <Modal open={open} onClose={onClose} title="Members">
      {canInvite && (
        <form onSubmit={invite} className="mb-5 space-y-2">
          <label className="label" htmlFor="invite-email">Add someone by email</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="invite-email"
              type="email"
              className="input w-full sm:w-auto sm:min-w-0 sm:flex-1"
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {role === 'owner' && (
              <select className="input flex-1 sm:w-28 sm:flex-none" value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Role">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            )}
            <button className="btn btn-primary flex-1 sm:flex-none" disabled={busy}>
              <UserPlus size={16} /> Add
            </button>
          </div>
          <p className="text-xs text-zinc-500">They need an Orbit account first. They'll get a notification right away.</p>
        </form>
      )}

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {project.members
          .filter((m) => m.user)
          .map((m) => (
            <li key={m.user._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="flex min-w-[11rem] flex-1 items-center gap-3">
                <Avatar user={m.user} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.name} {m.user._id === user._id && <span className="text-zinc-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{m.user.email}</p>
                </div>
              </div>
              <div className="ml-11 flex items-center gap-2 sm:ml-0">
              {role === 'owner' && m.role !== 'owner' ? (
                <select
                  className="input w-28 py-1 text-xs"
                  value={m.role}
                  onChange={(e) => changeRole(m.user._id, e.target.value)}
                  aria-label={`Role for ${m.user.name}`}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[m.role]}`}>{m.role}</span>
              )}
              {canRemove(m) && (
                <button
                  onClick={() => remove(m)}
                  className="btn px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  {m.user._id === user._id ? 'Leave' : 'Remove'}
                </button>
              )}
              </div>
            </li>
          ))}
      </ul>
    </Modal>
  );
}
