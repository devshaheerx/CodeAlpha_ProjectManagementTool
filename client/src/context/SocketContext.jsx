import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, setSocketId } from '../lib/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    // Same origin in dev (Vite proxy); the API host in production.
    const s = io(API_URL || undefined, { withCredentials: true });
    s.on('connect', () => setSocketId(s.id));
    s.on('disconnect', () => setSocketId(null));
    setSocket(s);

    return () => {
      s.disconnect();
      setSocketId(null);
      setSocket(null);
    };
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

/** Subscribe to a socket event for the lifetime of a component. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSocketEvent(event, handler) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return undefined;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, handler]);
}
