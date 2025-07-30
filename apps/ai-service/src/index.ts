import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { createLogger, format, transports } from 'winston';
import { register, collectDefaultMetrics } from 'prom-client';
import Redis from 'redis';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { createDiff } from 'diff';

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
  defaultMeta: { service: 'ai-service' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/ai-service-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/ai-service-combined.log' })
  ]
});

// Initialize metrics
collectDefaultMetrics({ register });

// Initialize Redis client
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Initialize PostgreSQL pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://speccursor:speccursor_dev@localhost:5432/speccursor',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs (lower for AI service)
  message: 'Too many requests from this IP, please try again later.'
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
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ai-service',
    version: process.env.npm_package_version || '0.1.0'
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
const validatePatchRequest = [
  body('upgradeId').isUUID(),
  body('originalCode').isString().notEmpty(),
  body('testFailure').isString().notEmpty(),
  body('ecosystem').isIn(['node', 'rust', 'python', 'go', 'lean']),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        errors: errors.array(),
        message: 'Invalid request data'
      });
    }
    next();
  }
];

// Generate AI patch endpoint
app.post('/api/v1/patches', validatePatchRequest, async (req, res) => {
  try {
    const { upgradeId, originalCode, testFailure, ecosystem } = req.body;
    
    // Generate patch ID
    const patchId = uuidv4();
    
    // Create patch record
    const patch = {
      id: patchId,
      upgradeId,
      patchType: 'ai-generated',
      status: 'generating',
      originalCode,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store in database
    const query = `
      INSERT INTO ai_patches (id, upgrade_id, patch_type, status, original_code, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    await pgPool.query(query, [
      patch.id,
      patch.upgradeId,
      patch.patchType,
      patch.status,
      patch.originalCode,
      patch.createdAt,
      patch.updatedAt
    ]);

    // Generate AI patch asynchronously
    generateAIPatch(patchId, upgradeId, originalCode, testFailure, ecosystem);

    res.status(202).json({
      id: patchId,
      status: 'generating',
      message: 'AI patch generation started'
    });

  } catch (error) {
    logger.error('Error creating AI patch request', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create AI patch request'
    });
  }
});

// Get patch status endpoint
app.get('/api/v1/patches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'SELECT * FROM ai_patches WHERE id = $1';
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Patch not found'
      });
    }

    const patch = result.rows[0];
    
    res.json({
      id: patch.id,
      upgradeId: patch.upgrade_id,
      patchType: patch.patch_type,
      status: patch.status,
      originalCode: patch.original_code,
      patchedCode: patch.patched_code,
      diffOutput: patch.diff_output,
      confidenceScore: patch.confidence_score,
      createdAt: patch.created_at,
      updatedAt: patch.updated_at,
      completedAt: patch.completed_at,
      errorMessage: patch.error_message
    });

  } catch (error) {
    logger.error('Error fetching patch status', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch patch status'
    });
  }
});

// AI patch generation function
async function generateAIPatch(patchId: string, upgradeId: string, originalCode: string, testFailure: string, ecosystem: string) {
  try {
    logger.info('Starting AI patch generation', { patchId, upgradeId, ecosystem });

    // Update status to generating
    await pgPool.query(
      'UPDATE ai_patches SET status = $1, updated_at = $2 WHERE id = $3',
      ['generating', new Date(), patchId]
    );

    // Prepare prompt for Claude
    const prompt = `You are an expert software engineer tasked with fixing a failing test after a dependency upgrade.

Context:
- Ecosystem: ${ecosystem}
- Original code: ${originalCode}
- Test failure: ${testFailure}

Your task is to generate a patch that fixes the failing test. The patch should:
1. Address the specific test failure
2. Maintain backward compatibility where possible
3. Follow best practices for the ${ecosystem} ecosystem
4. Include clear comments explaining the changes

Please provide:
1. The patched code
2. A brief explanation of the changes
3. A confidence score (0-1) for your solution

Format your response as JSON:
{
  "patchedCode": "...",
  "explanation": "...",
  "confidenceScore": 0.95
}`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const response = message.content[0];
    if (response.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    // Parse Claude's response
    const aiResponse = JSON.parse(response.text);
    
    // Generate diff
    const diff = createDiff(originalCode, aiResponse.patchedCode);

    // Update database with results
    await pgPool.query(
      `UPDATE ai_patches 
       SET status = $1, patched_code = $2, diff_output = $3, confidence_score = $4, 
           claude_response = $5, completed_at = $6, updated_at = $7 
       WHERE id = $8`,
      [
        'completed',
        aiResponse.patchedCode,
        diff,
        aiResponse.confidenceScore,
        JSON.stringify(aiResponse),
        new Date(),
        new Date(),
        patchId
      ]
    );

    logger.info('AI patch generation completed', { 
      patchId, 
      confidenceScore: aiResponse.confidenceScore 
    });

  } catch (error) {
    logger.error('Error generating AI patch', { error, patchId });
    
    // Update database with error
    await pgPool.query(
      `UPDATE ai_patches 
       SET status = $1, error_message = $2, updated_at = $3 
       WHERE id = $4`,
      ['failed', error.message, new Date(), patchId]
    );
  }
}

// List patches endpoint
app.get('/api/v1/patches', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, upgradeId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = 'SELECT * FROM ai_patches WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (upgradeId) {
      query += ` AND upgrade_id = $${paramIndex}`;
      params.push(upgradeId);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pgPool.query(query, params);
    
    res.json({
      patches: result.rows.map(row => ({
        id: row.id,
        upgradeId: row.upgrade_id,
        patchType: row.patch_type,
        status: row.status,
        confidenceScore: row.confidence_score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.rows.length
      }
    });

  } catch (error) {
    logger.error('Error fetching patches', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch patches'
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found'
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
    
    // Test Anthropic API connection
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('ANTHROPIC_API_KEY not set, AI features will be limited');
    }
    
    app.listen(PORT, () => {
      logger.info(`AI service started on port ${PORT}`);
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