import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

let globalSocket: Socket | null = null;

export const useSocket = () => {
  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }

    socketRef.current = globalSocket;

    return () => {
      // Don't disconnect on component unmount — keep global connection
    };
  }, [accessToken]);

  const joinSession = useCallback((sessionId: string) => {
    globalSocket?.emit('join:session', sessionId);
  }, []);

  const watchSession = useCallback((sessionId: string) => {
    globalSocket?.emit('watch:session', sessionId);
  }, []);

  const onEvent = useCallback(<T>(event: string, callback: (data: T) => void) => {
    globalSocket?.on(event, callback);
    return () => {
      globalSocket?.off(event, callback);
    };
  }, []);

  const offEvent = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (callback) {
      globalSocket?.off(event, callback);
    } else {
      globalSocket?.off(event);
    }
  }, []);

  return {
    socket: socketRef.current,
    joinSession,
    watchSession,
    onEvent,
    offEvent,
    isConnected: globalSocket?.connected ?? false,
  };
};

export const disconnectSocket = () => {
  globalSocket?.disconnect();
  globalSocket = null;
};
