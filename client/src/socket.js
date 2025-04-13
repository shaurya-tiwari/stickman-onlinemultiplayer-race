// client/src/socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  autoConnect: false, // turant connect mat karo
});

export default socket;
