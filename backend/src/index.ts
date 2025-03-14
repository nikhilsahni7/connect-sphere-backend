import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config';
import { redisService } from './services/redis.service';
import { initSocketService } from './services/socket.service';
import authRoutes from './routes/auth.routes';
import eventRoutes from './routes/event.routes';
import rsvpRoutes from './routes/rsvp.routes';
import chatRoutes from './routes/chat.routes';
import pollRoutes from './routes/poll.routes';
import participantRoutes from './routes/participant.routes';
import { PrismaClient } from '@prisma/client';
import { notificationService } from './services/notification.service';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Socket.IO
const socketService = initSocketService(server);

// Middleware
app.use(
  cors({
    origin: config.app.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/participants', participantRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('ConnectSphere API is running');
});

// Start the server
const PORT = config.app.port;
server.listen(PORT, () => {
  console.log(`🚀 ${config.app.name} server running at http://localhost:${PORT}`);

  // Test Redis connection on startup
  redisService
    .ping()
    .then(() => {
      console.log('✅ Redis connection successful');
      console.log('✅ Notification service initialized');
    })
    .catch((err) => console.error('❌ Redis connection failed:', err));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
