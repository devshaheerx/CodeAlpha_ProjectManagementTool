import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import User from './models/User.js';
import Project from './models/Project.js';
import { projectRoom, userRoom } from './utils/realtime.js';

// projectId -> Map<socketId, user> — who is looking at each board right now
const presence = new Map();

function broadcastPresence(io, projectId) {
  const viewers = presence.get(projectId);
  const unique = new Map();
  viewers?.forEach((u) => unique.set(u._id, u));
  io.to(projectRoom(projectId)).emit('presence', { projectId, users: [...unique.values()] });
}

function leaveCurrentProject(io, socket) {
  const projectId = socket.data.projectId;
  if (!projectId) return;
  socket.leave(projectRoom(projectId));
  socket.data.projectId = null;
  const viewers = presence.get(projectId);
  if (viewers) {
    viewers.delete(socket.id);
    if (!viewers.size) presence.delete(projectId);
  }
  broadcastPresence(io, projectId);
}

export function initSocket(server, origins) {
  const io = new Server(server, {
    cors: { origin: origins, credentials: true },
  });

  // Authenticate the socket with the same httpOnly JWT cookie the REST API uses.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || '');
      const token = cookies.token || socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id).select('name avatarColor');
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { _id: String(user._id), name: user.name, avatarColor: user.avatarColor };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(userRoom(user._id)); // personal room for notifications

    socket.on('project:join', async (projectId, ack) => {
      try {
        if (!isValidObjectId(projectId)) return ack?.({ ok: false });
        const project = await Project.findById(projectId).select('members');
        if (!project?.roleOf(user._id)) return ack?.({ ok: false });

        if (socket.data.projectId !== projectId) leaveCurrentProject(io, socket);
        socket.join(projectRoom(projectId));
        socket.data.projectId = projectId;
        if (!presence.has(projectId)) presence.set(projectId, new Map());
        presence.get(projectId).set(socket.id, user);
        broadcastPresence(io, projectId);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    // "Ayesha is typing…" inside a task's comment thread. Only relayed within the
    // project room the socket already joined (membership was checked on join).
    socket.on('comment:typing', ({ taskId, typing } = {}) => {
      const projectId = socket.data.projectId;
      if (!projectId || !isValidObjectId(taskId)) return;
      socket.to(projectRoom(projectId)).emit('comment:typing', { taskId, user, typing: Boolean(typing) });
    });

    socket.on('project:leave', () => leaveCurrentProject(io, socket));
    socket.on('disconnect', () => leaveCurrentProject(io, socket));
  });

  return io;
}
