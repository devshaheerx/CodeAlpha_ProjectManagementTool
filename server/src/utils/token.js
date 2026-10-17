import jwt from 'jsonwebtoken';

const isProd = () => process.env.NODE_ENV === 'production';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export const signToken = (userId) =>
  jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// In production the client (Vercel) and API (Render) live on different domains,
// so the cookie must be SameSite=None + Secure to be sent cross-site.
export const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: isProd() ? 'none' : 'lax',
  maxAge: SEVEN_DAYS,
  path: '/',
});

export const setAuthCookie = (res, userId) => res.cookie('token', signToken(userId), cookieOptions());

export const clearAuthCookie = (res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie('token', opts);
};
