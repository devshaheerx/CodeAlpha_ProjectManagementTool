/**
 * Creates three demo users and a sample project with tasks and comments.
 * Safe to re-run: it only removes the demo users and the projects they own.
 *
 *   npm run seed
 *
 * Demo logins (password for all: password123)
 *   shaheer@demo.com · ayesha@demo.com · bilal@demo.com
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Project from './models/Project.js';
import Task from './models/Task.js';
import Comment from './models/Comment.js';
import Notification from './models/Notification.js';

const DEMO = [
  { name: 'Syed Shaheer Ahmed', email: 'shaheer@demo.com', avatarColor: '#6366f1' },
  { name: 'Ayesha Khan', email: 'ayesha@demo.com', avatarColor: '#ec4899' },
  { name: 'Bilal Raza', email: 'bilal@demo.com', avatarColor: '#10b981' },
];

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function run() {
  await connectDB();

  const existing = await User.find({ email: { $in: DEMO.map((d) => d.email) } });
  const oldProjects = await Project.find({ owner: { $in: existing.map((u) => u._id) } });
  const oldIds = oldProjects.map((p) => p._id);
  await Promise.all([
    Task.deleteMany({ project: { $in: oldIds } }),
    Comment.deleteMany({ project: { $in: oldIds } }),
    Notification.deleteMany({ $or: [{ project: { $in: oldIds } }, { recipient: { $in: existing.map((u) => u._id) } }] }),
    Project.deleteMany({ _id: { $in: oldIds } }),
    User.deleteMany({ _id: { $in: existing.map((u) => u._id) } }),
  ]);

  const [shaheer, ayesha, bilal] = await Promise.all(
    DEMO.map((d) => User.create({ ...d, password: 'password123' }))
  );

  const web = await Project.create({
    name: 'Website Relaunch',
    description: 'Redesign and relaunch the company marketing site before the Q4 campaign.',
    color: '#6366f1',
    owner: shaheer._id,
    members: [
      { user: shaheer._id, role: 'owner' },
      { user: ayesha._id, role: 'admin' },
      { user: bilal._id, role: 'member' },
    ],
  });
  const [todo, doing, review, done] = web.columns.map((c) => c._id);

  const mobile = await Project.create({
    name: 'Mobile App MVP',
    description: 'First release of the customer mobile app.',
    color: '#10b981',
    owner: ayesha._id,
    members: [
      { user: ayesha._id, role: 'owner' },
      { user: shaheer._id, role: 'member' },
    ],
  });

  const tasks = [
    { column: todo, title: 'Write copy for the pricing page', priority: 'medium', assignees: [ayesha], dueDate: days(5) },
    { column: todo, title: 'Set up analytics events', priority: 'low', assignees: [bilal], dueDate: days(9) },
    { column: todo, title: 'Collect customer testimonials', priority: 'low', assignees: [] },
    { column: doing, title: 'Build responsive navbar', priority: 'high', assignees: [shaheer], dueDate: days(1), description: 'Sticky header, mobile drawer, dark mode toggle.' },
    { column: doing, title: 'Design hero section', priority: 'urgent', assignees: [ayesha, shaheer], dueDate: days(-1) },
    { column: review, title: 'Contact form API endpoint', priority: 'high', assignees: [bilal], dueDate: days(2), description: 'POST /api/contact with validation and rate limiting.' },
    { column: done, title: 'Choose brand colors and fonts', priority: 'medium', assignees: [ayesha] },
    { column: done, title: 'Set up repo and CI', priority: 'medium', assignees: [shaheer] },
  ];

  const order = {};
  const created = [];
  for (const t of tasks) {
    const key = String(t.column);
    order[key] = order[key] ?? 0;
    created.push(
      await Task.create({
        ...t,
        project: web._id,
        order: order[key]++,
        assignees: t.assignees.map((u) => u._id),
        createdBy: shaheer._id,
      })
    );
  }

  const hero = created[4];
  const comments = [
    { author: ayesha, text: 'First draft of the hero is in Figma. Thoughts on the headline?' },
    { author: shaheer, text: 'Looks great! Could we try a shorter headline and a bigger CTA?' },
    { author: bilal, text: 'Make sure the hero image is under 200KB for performance.' },
  ];
  for (const c of comments) {
    await Comment.create({ task: hero._id, project: web._id, author: c.author._id, text: c.text });
  }
  hero.commentCount = comments.length;
  await hero.save();

  const [mTodo, mDoing] = mobile.columns.map((c) => c._id);
  await Task.create([
    { project: mobile._id, column: mTodo, order: 0, title: 'Push notification setup', priority: 'medium', assignees: [shaheer._id], createdBy: ayesha._id, dueDate: days(4) },
    { project: mobile._id, column: mDoing, order: 0, title: 'Login screen UI', priority: 'high', assignees: [shaheer._id, ayesha._id], createdBy: ayesha._id, dueDate: days(3) },
  ]);

  await Notification.create({
    recipient: shaheer._id,
    actor: ayesha._id,
    type: 'project_invited',
    project: mobile._id,
    message: 'Ayesha Khan added you to "Mobile App MVP"',
  });

  console.log('\nSeed complete. Log in with any of these (password: password123):');
  DEMO.forEach((d) => console.log(`  ${d.email}`));
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
