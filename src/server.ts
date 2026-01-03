// Load environment variables FIRST
import './env.js';

import 'express-async-errors';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import passport from 'passport';
import http from 'http';

// Import configurations
import { connectDatabase } from './config/database.js';
import { logger, morganStream } from './config/logger.js';
import { CONSTANTS } from './config/constants.js';
import './config/passport.js'; // Initialize passport strategies

// Import middlewares
import { errorHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiter.js';

// Import webhook routes (must be BEFORE rate limiter)
import whopWebhookRoutes from './routes/whopWebhookRoutes.js';

// Import routes
import routes from './routes/index.js';

// Import Discord bot service
import { discordBotService } from './services/discordBotService.js';

// ✅ Import Whop message poller
import { whopMessagePoller } from './services/whopMessagePoller.js';

// ✅ Import Socket.IO initializer
import { initSocket } from './socket/index.js';

// Create Express app
const app: Application = express();

// ========================================
// MIDDLEWARE SETUP
// ========================================

// Trust proxy (required for Cloudflare tunnel and rate limiter)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  CONSTANTS.FRONTEND_URL,
  'http://localhost:3000',
  'https://pave-os-e732.vercel.app',
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow all Whop iframe origins (for Dashboard App)
      if (origin && origin.includes('whop.com')) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments (pattern: https://*-pave-os-*.vercel.app)
      if (origin && origin.includes('vercel.app')) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Compression middleware
app.use(compression());

// Logging middleware
if (CONSTANTS.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: morganStream }));
}

// ⚠️ IMPORTANT: Webhook routes BEFORE rate limiter (webhooks bypass rate limiting)
app.use(`/api/${CONSTANTS.API_VERSION}/webhooks/whop`, whopWebhookRoutes);

// Rate limiting
app.use(`/api/${CONSTANTS.API_VERSION}`, apiLimiter);

// ========================================
// ROUTES
// ========================================

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'PaveOS API is running',
    timestamp: new Date().toISOString(),
    environment: CONSTANTS.NODE_ENV,
  });
});

app.use(`/api/${CONSTANTS.API_VERSION}`, routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// ========================================
// SERVER INITIALIZATION
// ========================================

const PORT = CONSTANTS.PORT;

// ✅ CREATE HTTP SERVER FROM EXPRESS
const server = http.createServer(app);

// ✅ INITIALIZE SOCKET.IO ON THE SAME SERVER
initSocket(server);

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Start Discord bot
    try {
      await discordBotService.startBot();
      logger.info('✅ Discord bot started successfully');
    } catch (error: any) {
      logger.warn('⚠️ Discord bot failed to start:', error.message);
      logger.warn('Discord features will be unavailable until bot is started');
    }

    // ✅ Start HTTP + Socket Server
    server.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║              🚀 PaveOS Backend Server                 ║
║                                                        ║
║  Server running on: http://localhost:${PORT}           ║
║  Environment: ${CONSTANTS.NODE_ENV}                            ║
║  API Version: ${CONSTANTS.API_VERSION}                                  ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);

      // ✅ Start Whop message poller (since webhooks aren't available)
      whopMessagePoller.start();
      logger.info('🔄 Whop message poller started (checking every 30 seconds)');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptionsddsds
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the servers
startServer();

export default app;
