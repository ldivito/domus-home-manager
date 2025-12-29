/**
 * Centralized Logger
 *
 * A configurable logging utility that provides consistent logging across the application.
 * In production, only warnings and errors are logged. In development, all logs are shown.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.debug('Debug message', data)
 *   logger.info('Info message')
 *   logger.warn('Warning message', error)
 *   logger.error('Error message', error)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  enabled: boolean
  minLevel: LogLevel
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production'

// Default configuration
const config: LoggerConfig = {
  enabled: true,
  // In production, only show warnings and errors
  minLevel: isProduction ? 'warn' : 'debug',
}

function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel]
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  return `${prefix} ${message}`
}

/**
 * Logger utility with configurable log levels
 */
export const logger = {
  /**
   * Debug level logging - only shown in development
   */
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message), ...args)
    }
  },

  /**
   * Info level logging - only shown in development
   */
  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message), ...args)
    }
  },

  /**
   * Warning level logging - shown in all environments
   */
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message), ...args)
    }
  },

  /**
   * Error level logging - shown in all environments
   */
  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message), ...args)
    }
  },

  /**
   * Log with a specific context/module prefix
   */
  withContext(context: string) {
    return {
      debug: (message: string, ...args: unknown[]) => logger.debug(`[${context}] ${message}`, ...args),
      info: (message: string, ...args: unknown[]) => logger.info(`[${context}] ${message}`, ...args),
      warn: (message: string, ...args: unknown[]) => logger.warn(`[${context}] ${message}`, ...args),
      error: (message: string, ...args: unknown[]) => logger.error(`[${context}] ${message}`, ...args),
    }
  },

  /**
   * Configure the logger
   */
  configure(options: Partial<LoggerConfig>): void {
    if (options.enabled !== undefined) config.enabled = options.enabled
    if (options.minLevel !== undefined) config.minLevel = options.minLevel
  },

  /**
   * Disable all logging
   */
  disable(): void {
    config.enabled = false
  },

  /**
   * Enable logging
   */
  enable(): void {
    config.enabled = true
  },
}

// Export context-specific loggers for common use cases
export const dbLogger = logger.withContext('DB')
export const syncLogger = logger.withContext('Sync')
export const authLogger = logger.withContext('Auth')
export const apiLogger = logger.withContext('API')
