import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import { createLogger, format, transports } from 'winston';
import { register, collectDefaultMetrics } from 'prom-client';
import Redis from 'redis';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'controller' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({
      filename: 'logs/controller-error.log',
      level: 'error',
    }),
    new transports.File({ filename: 'logs/controller-combined.log' }),
  ],
});

// Initialize metrics
collectDefaultMetrics({ register });

// Initialize Redis client
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Initialize PostgreSQL pool
const pgPool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://speccursor:speccursor_dev@localhost:5432/speccursor',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'controller',
    version: process.env.npm_package_version || '0.1.0',
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error('Error generating metrics', { error: err });
    res.status(500).end();
  }
});

// Validation middleware
const validateUpgradeRequest = [
  body('repository').isString().notEmpty(),
  body('ecosystem').isIn(['node', 'rust', 'python', 'go', 'lean']),
  body('packageName').isString().notEmpty(),
  body('currentVersion').isString().notEmpty(),
  body('targetVersion').isString().notEmpty(),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array(),
        message: 'Invalid request data',
      });
    }
    next();
  },
];

// Upgrade workflow endpoint
app.post('/api/v1/upgrades', validateUpgradeRequest, async (req, res) => {
  try {
    const {
      repository,
      ecosystem,
      packageName,
      currentVersion,
      targetVersion,
    } = req.body;

    // Generate upgrade ID
    const upgradeId = uuidv4();

    // Create upgrade record
    const upgrade = {
      id: upgradeId,
      repository,
      ecosystem,
      packageName,
      currentVersion,
      targetVersion,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in database
    const query = `
      INSERT INTO upgrades (id, repository, ecosystem, package_name, current_version, target_version, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pgPool.query(query, [
      upgrade.id,
      upgrade.repository,
      upgrade.ecosystem,
      upgrade.packageName,
      upgrade.currentVersion,
      upgrade.targetVersion,
      upgrade.status,
      upgrade.createdAt,
      upgrade.updatedAt,
    ]);

    // Queue upgrade job
    await redisClient.lPush(
      'upgrade_queue',
      JSON.stringify({
        upgradeId,
        repository,
        ecosystem,
        packageName,
        currentVersion,
        targetVersion,
      })
    );

    logger.info('Upgrade request created', {
      upgradeId,
      repository,
      ecosystem,
    });

    res.status(201).json({
      id: upgradeId,
      status: 'pending',
      message: 'Upgrade request created successfully',
    });
  } catch (error) {
    logger.error('Error creating upgrade request', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create upgrade request',
    });
  }
});

// Get upgrade status endpoint
app.get('/api/v1/upgrades/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM upgrades WHERE id = $1';
    const result = await pgPool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Upgrade not found',
      });
    }

    const upgrade = result.rows[0];

    res.json({
      id: upgrade.id,
      repository: upgrade.repository,
      ecosystem: upgrade.ecosystem,
      packageName: upgrade.package_name,
      currentVersion: upgrade.current_version,
      targetVersion: upgrade.target_version,
      status: upgrade.status,
      createdAt: upgrade.created_at,
      updatedAt: upgrade.updated_at,
      completedAt: upgrade.completed_at,
      errorMessage: upgrade.error_message,
    });
  } catch (error) {
    logger.error('Error fetching upgrade status', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch upgrade status',
    });
  }
});

// List upgrades endpoint
app.get('/api/v1/upgrades', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, ecosystem } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM upgrades WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (ecosystem) {
      query += ` AND ecosystem = $${paramIndex}`;
      params.push(ecosystem);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pgPool.query(query, params);

    res.json({
      upgrades: result.rows.map(row => ({
        id: row.id,
        repository: row.repository,
        ecosystem: row.ecosystem,
        packageName: row.package_name,
        currentVersion: row.current_version,
        targetVersion: row.target_version,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.rows.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching upgrades', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch upgrades',
    });
  }
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
    });
  }
);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found',
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await pgPool.query('SELECT NOW()');
    logger.info('Database connection established');

    // Test Redis connection
    await redisClient.connect();
    logger.info('Redis connection established');

    app.listen(PORT, () => {
      logger.info(`Controller service started on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pgPool.end();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await pgPool.end();
  await redisClient.quit();
  process.exit(0);
});

// Start the server
startServer();
