// Production-ready logger for Torrent Snag
// Automatically disabled in production builds

class Logger {
  constructor() {
    // Determine if we're in development mode
    this.isDevelopment = this.checkDevelopmentMode();
    this.logLevel = this.isDevelopment ? 'debug' : 'error';
  }

  checkDevelopmentMode() {
    // Extension is in development if loaded unpacked
    try {
      return chrome.runtime.getManifest().update_url === undefined;
    } catch (e) {
      return false;
    }
  }

  debug(...args) {
    if (this.isDevelopment && this.shouldLog('debug')) {
    }
  }

  info(...args) {
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  warn(...args) {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args) {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }

  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
}

// Create global logger instance
const logger = new Logger();

// Usage:
// logger.debug('This only shows in development');
// logger.error('This always shows for debugging user issues');
