import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const taskSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    column: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, default: 0 },
    title: { type: String, required: [true, 'Task title is required'], trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, column: 1, order: 1 });
taskSchema.index({ assignees: 1 });

export default mongoose.model('Task', taskSchema);
