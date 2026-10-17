import mongoose from 'mongoose';

const { Schema } = mongoose;

export const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];
export const ROLES = ['owner', 'admin', 'member'];

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const columnSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
});

const projectSchema = new Schema(
  {
    name: { type: String, required: [true, 'Project name is required'], trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    color: { type: String, default: '#6366f1' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
    columns: {
      type: [columnSchema],
      default: () => DEFAULT_COLUMNS.map((name) => ({ name })),
    },
  },
  { timestamps: true }
);

projectSchema.index({ 'members.user': 1 });

const idOf = (u) => String(u?._id ?? u);

/** Returns 'owner' | 'admin' | 'member' | null for a user id. Works on populated and raw docs. */
projectSchema.methods.roleOf = function (userId) {
  const m = this.members.find((mem) => idOf(mem.user) === String(userId));
  return m ? m.role : null;
};

projectSchema.methods.memberIds = function () {
  return new Set(this.members.map((m) => idOf(m.user)));
};

projectSchema.methods.hasColumn = function (columnId) {
  return this.columns.some((c) => String(c._id) === String(columnId));
};

projectSchema.methods.doneColumnId = function () {
  const last = this.columns[this.columns.length - 1];
  return last ? String(last._id) : null;
};

export default mongoose.model('Project', projectSchema);
