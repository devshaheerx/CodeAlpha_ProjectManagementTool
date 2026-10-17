import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // send the httpOnly JWT cookie
});

/** The server uses this header to skip echoing a change back to the socket that made it. */
export function setSocketId(id) {
  if (id) api.defaults.headers.common['x-socket-id'] = id;
  else delete api.defaults.headers.common['x-socket-id'];
}

export const errMsg = (err) => err?.response?.data?.message || err?.message || 'Something went wrong';
