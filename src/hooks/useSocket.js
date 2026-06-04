import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL, { autoConnect: false });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.connect();
    return () => socket.disconnect();
  }, []);

  function emit(event, data) {
    socketRef.current?.emit(event, data);
  }

  function on(event, handler) {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }

  function off(event, handler) {
    socketRef.current?.off(event, handler);
  }

  return { connected, emit, on, off, socket: socketRef };
}
