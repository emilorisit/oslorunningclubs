
import { db } from './db';
import { logs } from '../shared/schema';

export class LoggingService {
  static async log(level: string, message: string, metadata?: any, source?: string) {
    try {
      await db.insert(logs).values({
        level,
        message,
        metadata,
        source,
      });
    } catch (error) {
      console.error('Failed to write log to database:', error);
      // Fallback to console
      console.log(`${level}: ${message}`, metadata);
    }
  }

  static async error(message: string, metadata?: any, source?: string) {
    return this.log('error', message, metadata, source);
  }

  static async info(message: string, metadata?: any, source?: string) {
    return this.log('info', message, metadata, source);
  }

  static async warn(message: string, metadata?: any, source?: string) {
    return this.log('warn', message, metadata, source);
  }
}

export const logger = LoggingService;
