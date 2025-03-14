import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { redisService } from './redis.service';
import { config } from '../config';

export class SocketService {
  private readonly io: Server;

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: config.app.frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle joining event rooms
      socket.on('join-event', (eventId: string) => {
        socket.join(`event:${eventId}`);
        console.log(`Socket ${socket.id} joined event:${eventId}`);
      });

      // Handle joining user-specific rooms
      socket.on('join-user', (userId: string) => {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined user:${userId}`);
      });

      // Handle leaving event rooms
      socket.on('leave-event', (eventId: string) => {
        socket.leave(`event:${eventId}`);
        console.log(`Socket ${socket.id} left event:${eventId}`);
      });

      // Handle chat messages
      socket.on(
        'send-message',
        async (data: { eventId: string; message: string; userId: string }) => {
          // We'll implement message saving in the chat service
          // For now, just broadcast the message
          this.io.to(`event:${data.eventId}`).emit('new-message', {
            ...data,
            timestamp: new Date(),
          });

          // Also publish to Redis for other services
          await redisService.publish(redisService.getEventChatChannel(data.eventId), {
            type: 'NEW_MESSAGE',
            eventId: data.eventId,
            userId: data.userId,
            message: data.message,
            timestamp: new Date(),
          });
        }
      );

      // Handle RSVP updates
      socket.on(
        'update-rsvp',
        async (data: { eventId: string; userId: string; status: string }) => {
          // We'll implement RSVP saving in the RSVP service
          // For now, just broadcast the update
          this.io.to(`event:${data.eventId}`).emit('rsvp-updated', {
            ...data,
            timestamp: new Date(),
          });
        }
      );

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    // Listen for Redis events and broadcast to sockets
    this.setupRedisListeners();
  }

  private setupRedisListeners() {
    // Listen for RSVP updates from Redis and broadcast to sockets
    redisService.subscribe('event:*:rsvp', (message) => {
      if (message.eventId) {
        // Broadcast to the event room
        this.io.to(`event:${message.eventId}`).emit('rsvp-updated', message);

        // Also notify the user who made the RSVP
        if (message.userId) {
          this.io.to(`user:${message.userId}`).emit('rsvp-updated', message);
        }

        // Notify the event creator
        if (message.creatorId && message.userId !== message.creatorId) {
          this.io.to(`user:${message.creatorId}`).emit('event-rsvp-updated', {
            ...message,
            eventTitle: message.eventTitle || 'an event',
          });
        }
      }
    });

    // Example: Listen for chat messages from Redis and broadcast to sockets
    redisService.subscribe('event:*:chat', (message) => {
      if (message.type === 'NEW_MESSAGE' && message.eventId) {
        this.io.to(`event:${message.eventId}`).emit('new-message', message);
      }
    });

    // Example: Listen for poll updates from Redis and broadcast to sockets
    redisService.subscribe('event:*:poll', (message) => {
      if (message.type === 'POLL_UPDATED' && message.eventId) {
        this.io.to(`event:${message.eventId}`).emit('poll-updated', message);
      }
    });

    // Add this listener
    redisService.subscribe('event:*:participant', (message) => {
      if (message.eventId) {
        if (message.type === 'PARTICIPANT_KICKED') {
          this.io.to(`event:${message.eventId}`).emit('participant-kicked', message);
        } else if (message.type === 'PARTICIPANT_LEFT') {
          this.io.to(`event:${message.eventId}`).emit('participant-left', message);
        }
      }
    });
  }

  // Method to emit events programmatically from other services
  emitToEvent(eventId: string, eventName: string, data: any) {
    this.io.to(`event:${eventId}`).emit(eventName, data);
  }

  // Method to emit events to a specific user
  emitToUser(userId: string, eventName: string, data: any) {
    this.io.to(`user:${userId}`).emit(eventName, data);
  }
}

// We'll initialize this in the main server file
let socketService: SocketService;

export function initSocketService(server: HttpServer) {
  socketService = new SocketService(server);
  return socketService;
}

export function getSocketService() {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService;
}
