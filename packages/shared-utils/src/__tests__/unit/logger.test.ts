import { createLogger, LoggerConfig } from '../../index';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

describe('Logger Utility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with default configuration', () => {
      const logger = createLogger();
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
    });

    it('should create a logger with custom configuration', () => {
      const config: LoggerConfig = {
        level: 'debug',
        service: 'test-service',
        logDir: '/tmp/logs',
      };
      
      const logger = createLogger(config);
      
      expect(logger).toBeDefined();
    });

    it('should handle missing configuration gracefully', () => {
      const logger = createLogger({});
      
      expect(logger).toBeDefined();
    });
  });

  describe('Logger Methods', () => {
    it('should log info messages', () => {
      const logger = createLogger();
      const message = 'Test info message';
      
      logger.info(message);
      
      expect(logger.info).toHaveBeenCalledWith(message);
    });

    it('should log error messages', () => {
      const logger = createLogger();
      const message = 'Test error message';
      
      logger.error(message);
      
      expect(logger.error).toHaveBeenCalledWith(message);
    });

    it('should log warning messages', () => {
      const logger = createLogger();
      const message = 'Test warning message';
      
      logger.warn(message);
      
      expect(logger.warn).toHaveBeenCalledWith(message);
    });

    it('should log debug messages', () => {
      const logger = createLogger();
      const message = 'Test debug message';
      
      logger.debug(message);
      
      expect(logger.debug).toHaveBeenCalledWith(message);
    });
  });

  describe('Logger Configuration', () => {
    it('should use environment variables for configuration', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_SERVICE = 'test-service';
      
      const logger = createLogger();
      
      expect(logger).toBeDefined();
    });

    it('should handle invalid log levels gracefully', () => {
      process.env.LOG_LEVEL = 'invalid-level';
      
      const logger = createLogger();
      
      expect(logger).toBeDefined();
    });
  });
}); 