/**
 * Xandeum Explorer - Logging Utility
 * Clean, structured logging for production and development
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m",  // Green
  warn: "\x1b[33m",  // Yellow
  error: "\x1b[31m", // Red
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

class Logger {
  private service: string;
  private minLevel: LogLevel;
  private useColors: boolean;

  constructor(service: string = "xandeum-explorer") {
    this.service = service;
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
    this.useColors = process.env.NODE_ENV !== "production";
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = this.formatTimestamp();
    const levelStr = level.toUpperCase().padEnd(5);
    
    if (this.useColors) {
      const color = LEVEL_COLORS[level];
      let output = `${color}${BOLD}[${levelStr}]${RESET} ${timestamp} ${message}`;
      
      if (context && Object.keys(context).length > 0) {
        output += ` ${JSON.stringify(context)}`;
      }
      
      return output;
    }

    // Production: JSON structured logging
    const logEntry = {
      level: level.toUpperCase(),
      timestamp,
      service: this.service,
      message,
      ...context,
    };

    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, context));
    }
  }

  // Specialized logging methods
  sync(message: string, context?: LogContext): void {
    this.info(`🔄 [Sync] ${message}`, context);
  }

  api(method: string, path: string, status: number, durationMs: number): void {
    const emoji = status >= 400 ? "❌" : "✅";
    this.info(`${emoji} ${method} ${path} ${status} ${durationMs}ms`);
  }

  ai(feature: string, message: string, context?: LogContext): void {
    this.info(`🤖 [AI:${feature}] ${message}`, context);
  }

  crawler(message: string, context?: LogContext): void {
    this.info(`🕷️ [Crawler] ${message}`, context);
  }

  geo(message: string, context?: LogContext): void {
    this.debug(`🌍 [Geo] ${message}`, context);
  }
}

// Export singleton instance
const logger = new Logger();
export default logger;

// Named exports for specific contexts
export const log = logger;
