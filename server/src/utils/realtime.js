export const projectRoom = (projectId) => `project:${projectId}`;
export const userRoom = (userId) => `user:${userId}`;

/**
 * Broadcast to everyone in a project room except the socket that made the request.
 * The client sends its socket id in the `x-socket-id` header, so the person who made
 * the change updates from the HTTP response and doesn't receive a duplicate event.
 */
export function emitToProject(req, projectId, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  const sid = req.get('x-socket-id');
  const target = sid ? io.to(projectRoom(projectId)).except(sid) : io.to(projectRoom(projectId));
  target.emit(event, payload);
}

export function emitToUser(req, userId, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload);
}
