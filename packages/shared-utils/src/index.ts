import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { createClient } from 'redis';
import { Pool, PoolConfig } from 'pg';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { 
  AppConfig, 
  DatabaseConfig, 
  RedisConfig, 
  SpecCursorError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  Result,
  AsyncResult,
  HealthCheck,
  Metric,
  AuditLog
} from '@speccursor/shared-types';

// ============================================================================
// Logger Configuration
// ============================================================================

export class Logger {
  private logger: winston.Logger;

  constructor(service: string, level: string = 'info') {
    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new DailyRotateFile({
          filename: `logs/${service}-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error'
        })
      ]
    });
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.logger.error(message, { error: error?.stack, ...meta });
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }
}

// ============================================================================
// Database Connection
// ============================================================================

export class Database {
  private pool: Pool;
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.logger = logger;
    
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeout * 1000,
      connectionTimeoutMillis: 10000,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      this.logger.debug('Database query executed', { 
        text, 
        duration, 
        rowCount: result.rowCount 
      });
      return result.rows;
    } catch (error) {
      this.logger.error('Database query failed', error as Error, { text, params });
      throw error;
    }
  }

  async getClient(): Promise<Pool['connect']> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error as Error);
      return false;
    }
  }
}

// ============================================================================
// Redis Connection
// ============================================================================

export class Redis {
  private client: ReturnType<typeof createClient>;
  private logger: Logger;

  constructor(config: RedisConfig, logger: Logger) {
    this.logger = logger;
    
    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.db,
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis client error', err);
    });

    this.client.on('connect', () => {
      this.logger.info('Redis client connected');
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error('Redis get failed', error as Error, { key });
      throw error;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error('Redis set failed', error as Error, { key, value });
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      this.logger.error('Redis del failed', error as Error, { key });
      throw error;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key);
    } catch (error) {
      this.logger.error('Redis exists failed', error as Error, { key });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed', error as Error);
      return false;
    }
  }
}

// ============================================================================
// HTTP Client
// ============================================================================

export class HttpClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(baseURL: string, logger: Logger, config?: AxiosRequestConfig) {
    this.logger = logger;
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SpecCursor/1.0.0',
      },
      ...config,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('HTTP request', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        this.logger.error('HTTP request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('HTTP response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        this.logger.error('HTTP response error', error, {
          status: error.response?.status,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// ============================================================================
// Security Utilities
// ============================================================================

export class SecurityUtils {
  static generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  static generateJWT(payload: Record<string, any>, secret: string, expiresIn: string = '1h'): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (expiresIn.includes('h') ? parseInt(expiresIn) * 3600 : parseInt(expiresIn));

    const jwtPayload = {
      ...payload,
      iat: now,
      exp
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  static verifyJWT(token: string, secret: string): Record<string, any> | null {
    try {
      const [headerB64, payloadB64, signature] = token.split('.');
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

export class ValidationUtils {
  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 1000); // Limit length
  }

  static validateJson(json: string): boolean {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

export class RateLimiter {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async checkLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const current = this.limits.get(key);

    if (!current || now > current.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (current.count >= limit) {
      this.logger.warn('Rate limit exceeded', { key, limit, windowMs });
      return false;
    }

    current.count++;
    return true;
  }

  async getRemaining(key: string): Promise<number> {
    const current = this.limits.get(key);
    if (!current || Date.now() > current.resetTime) {
      return 0;
    }
    return Math.max(0, current.count);
  }
}

// ============================================================================
// Metrics Collection
// ============================================================================

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  recordCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);
    
    if (existing && existing.type === 'counter') {
      existing.value += value;
    } else {
      this.metrics.set(key, {
        name,
        value,
        type: 'counter',
        labels,
        timestamp: new Date(),
      });
    }
  }

  recordGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, {
      name,
      value,
      type: 'gauge',
      labels,
      timestamp: new Date(),
    });
  }

  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);
    
    if (existing && existing.type === 'histogram') {
      // For simplicity, we'll just track the latest value
      existing.value = value;
      existing.timestamp = new Date();
    } else {
      this.metrics.set(key, {
        name,
        value,
        type: 'histogram',
        labels,
        timestamp: new Date(),
      });
    }
  }

  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}${labelStr ? `{${labelStr}}` : ''}`;
  }
}

// ============================================================================
// Audit Logging
// ============================================================================

export class AuditLogger {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  logAction(
    action: string,
    resourceType: string,
    resourceId: string,
    userId?: string,
    metadata: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): void {
    const auditLog: AuditLog = {
      id: uuidv4(),
      action,
      resourceType,
      resourceId,
      userId,
      metadata,
      timestamp: new Date(),
      ipAddress,
      userAgent,
    };

    this.logger.info('Audit log', auditLog);
  }
}

// ============================================================================
// Health Check
// ============================================================================

export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  addCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async performHealthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    const checks: Record<string, { status: 'healthy' | 'unhealthy'; message?: string; duration?: number }> = {};
    
    for (const [name, check] of this.checks) {
      const checkStart = Date.now();
      try {
        const isHealthy = await check();
        const duration = Date.now() - checkStart;
        
        checks[name] = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          duration,
        };
      } catch (error) {
        const duration = Date.now() - checkStart;
        checks[name] = {
          status: 'unhealthy',
          message: (error as Error).message,
          duration,
        };
      }
    }

    const overallStatus = Object.values(checks).every(c => c.status === 'healthy')
      ? 'healthy'
      : Object.values(checks).some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Date.now() - startTime,
      checks,
    };
  }
}

// ============================================================================
// Error Handling
// ============================================================================

export class ErrorHandler {
  static handleError(error: unknown, logger: Logger, context?: string): SpecCursorError {
    if (error instanceof SpecCursorError) {
      return error;
    }

    if (error instanceof Error) {
      logger.error('Unexpected error', error, { context });
      return new SpecCursorError(
        'Internal server error',
        'INTERNAL_ERROR',
        500,
        { originalError: error.message }
      );
    }

    logger.error('Unknown error type', new Error('Unknown error'), { context, error });
    return new SpecCursorError(
      'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }

  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    logger: Logger,
    context?: string
  ): Promise<Result<T, SpecCursorError>> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      const handledError = this.handleError(error, logger, context);
      return { success: false, error: handledError };
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateId(): string {
  return uuidv4();
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const attempt = async () => {
      try {
        attempts++;
        const result = await operation();
        resolve(result);
      } catch (error) {
        if (attempts >= maxRetries) {
          reject(error);
        } else {
          setTimeout(attempt, delay * attempts);
        }
      }
    };

    attempt();
  });
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================================
// Configuration Loading
// ============================================================================

export function loadConfig(): AppConfig {
  const config: AppConfig = {
    port: parseInt(process.env.PORT || '3000'),
    environment: process.env.NODE_ENV || 'development',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'speccursor',
      username: process.env.DB_USER || 'speccursor',
      password: process.env.DB_PASSWORD || 'speccursor_dev',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300'),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'speccursor:',
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || '',
      model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.1'),
      timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000'),
    },
    lean: {
      version: process.env.LEAN_VERSION || '4.20.0',
      timeoutSeconds: parseInt(process.env.LEAN_TIMEOUT || '300'),
      memoryLimitMb: parseInt(process.env.LEAN_MEMORY_LIMIT || '2048'),
      mathlibPath: process.env.LEAN_MATHLIB_PATH || '/usr/local/lib/lean',
    },
    security: {
      sandboxEnabled: process.env.SANDBOX_ENABLED !== 'false',
      maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '600'),
      memoryLimit: process.env.MEMORY_LIMIT || '2GB',
      allowedCommands: (process.env.ALLOWED_COMMANDS || '').split(',').filter(Boolean),
    },
    monitoring: {
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      tracingEnabled: process.env.TRACING_ENABLED !== 'false',
      logLevel: process.env.LOG_LEVEL || 'info',
      prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090'),
      jaegerEndpoint: process.env.JAEGER_ENDPOINT,
    },
  };

  return config;
} 