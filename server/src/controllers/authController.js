import User from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { setAuthCookie, clearAuthCookie } from '../utils/token.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export const register = async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  if (!name) throw new HttpError(400, 'Name is required');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

  if (await User.exists({ email })) throw new HttpError(409, 'An account with that email already exists');

  const user = await User.create({ name, email, password });
  setAuthCookie(res, user._id);
  res.status(201).json({ user });
};

export const login = async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  setAuthCookie(res, user._id);
  res.json({ user });
};

export const logout = (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
};

export const me = (req, res) => {
  res.json({ user: req.user });
};

export const updateMe = async (req, res) => {
  const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
  if (name !== undefined) {
    if (!name) throw new HttpError(400, 'Name cannot be empty');
    req.user.name = name;
  }
  await req.user.save();
  res.json({ user: req.user });
};
