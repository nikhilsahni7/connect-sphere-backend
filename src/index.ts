import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config';
import { redisService } from './services/redis.service';
import { initSocketService } from './services/socket.service';
import { PrismaClient } from '@prisma/client';

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
    .then(() => console.log('✅ Redis connection successful'))
    .catch((err) => console.error('❌ Redis connection failed:', err));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
