import winston from 'winston';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const logLevel = process.env.LOG_LEVEL || 'debug';
const isProduction = process.env.NODE_ENV === 'production';

// Custom format for console logging
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// Custom format for file logging
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [
  // Console transport (used in both dev and production)
  new winston.transports.Console({
    format: isProduction ? fileFormat : consoleFormat,
  }),
];

// Add file transports only in development (not on serverless)
if (!isProduction) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');

    // Create logs directory if it doesn't exist
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: fileFormat,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: fileFormat,
      })
    );
  } catch (error) {
    // If file logging fails, just use console
    console.warn('File logging not available, using console only');
  }
}

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
