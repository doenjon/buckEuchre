import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer): void {
  ioInstance = io;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

export function clearSocketServer(): void {
  ioInstance = null;
}
