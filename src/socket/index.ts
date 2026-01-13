import { Server } from "socket.io";
import http from "http";
import { CONSTANTS } from "../config/constants.js";
import { logger } from "../config/logger.js";

let io: Server;

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
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

        // Allow specific origins
        const allowedOrigins = [
          CONSTANTS.FRONTEND_URL,
          "http://localhost:3000",
          "https://pave-os-e732.vercel.app",
          "https://pave-os.vercel.app",
        ].filter(Boolean);

        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          logger.warn(`Socket.IO CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    
    // ✅ WHOP-FIRST: Join rooms based on Whop identifiers
    const { whopUserId, whopCompanyId } = socket.handshake.auth;
    
    if (whopUserId) {
      socket.join(whopUserId);
      console.log(`✅ Socket ${socket.id} joined user room: ${whopUserId}`);
    }
    
    if (whopCompanyId) {
      socket.join(whopCompanyId);
      console.log(`✅ Socket ${socket.id} joined company room: ${whopCompanyId}`);
    }

    socket.on("join-user", (userId) => {
      socket.join(userId);
      console.log(`Socket ${socket.id} manually joined user room: ${userId}`);
    });

    socket.on("join-company", (companyId) => {
      socket.join(companyId);
      console.log(`Socket ${socket.id} manually joined company room: ${companyId}`);
    });

    socket.on("lead:join", (data) => {
      const { leadId } = data;
      socket.join(`lead:${leadId}`);
    });

    socket.on("lead:leave", (data) => {
      const { leadId } = data;
      socket.leave(`lead:${leadId}`);
    });

    socket.on("discord:join", (data) => {
      const { discordUserId } = data;
      socket.join(`discord:${discordUserId}`);
    });

    socket.on("discord:leave", (data) => {
      const { discordUserId } = data;
      socket.leave(`discord:${discordUserId}`);
    });

    socket.on("disconnect", () => {
      logger.warn(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};

