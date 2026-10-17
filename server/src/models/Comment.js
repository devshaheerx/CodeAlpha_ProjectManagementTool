import mongoose from 'mongoose';

const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: [true, 'Comment cannot be empty'], trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

commentSchema.index({ task: 1, createdAt: 1 });

export default mongoose.model('Comment', commentSchema);
