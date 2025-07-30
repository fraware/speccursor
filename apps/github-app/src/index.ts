import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { Webhooks, createNodeMiddleware } from '@octokit/webhooks';
import {
  Logger,
  Database,
  Redis,
  HttpClient,
  SecurityUtils,
  ErrorHandler,
  loadConfig,
} from '@speccursor/shared-utils';
import { ConfigManager } from '@speccursor/shared-config';
import {
  GitHubWebhookPayload,
  GitHubReleaseWebhook,
  GitHubPullRequestWebhook,
  SpecCursorError,
  ValidationError,
  HealthCheck,
} from '@speccursor/shared-types';

// ============================================================================
// Configuration
// ============================================================================

const configManager = new ConfigManager();
const config = configManager.getAppConfig();
const githubConfig = configManager.getGitHubConfig();

// ============================================================================
// Logger Setup
// ============================================================================

const logger = new Logger('github-app', config.monitoring.logLevel);

// ============================================================================
// Database and Redis Setup
// ============================================================================

const database = new Database(config.database, logger);
const redis = new Redis(config.redis, logger);

// ============================================================================
// GitHub App Setup
// ============================================================================

const appAuth = createAppAuth({
  appId: githubConfig.appId!,
  privateKey: githubConfig.privateKey,
});

const webhooks = new Webhooks({
  secret: githubConfig.webhookSecret,
});

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://github.com', 'https://api.github.com']
        : true,
    credentials: true,
  })
);

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// Webhook Signature Verification
// ============================================================================

function verifyWebhookSignature(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);

  if (!signature) {
    logger.warn('Missing webhook signature', {
      headers: req.headers,
      url: req.url,
    });
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const signatureWithoutPrefix = signature.replace('sha256=', '');

  if (
    !SecurityUtils.verifySignature(
      payload,
      signatureWithoutPrefix,
      githubConfig.webhookSecret
    )
  ) {
    logger.warn('Invalid webhook signature', {
      signature,
      url: req.url,
    });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}

// ============================================================================
// Webhook Handlers
// ============================================================================

webhooks.on('release.published', async event => {
  try {
    logger.info('Release published webhook received', {
      repository: event.payload.repository.full_name,
      release: event.payload.release.tag_name,
      action: event.payload.action,
    });

    const releaseData = event.payload as GitHubReleaseWebhook;

    // Process the release for potential dependency upgrades
    await processRelease(releaseData);
  } catch (error) {
    logger.error('Error processing release webhook', error as Error, {
      event: event.payload,
    });
  }
});

webhooks.on('pull_request.opened', async event => {
  try {
    logger.info('Pull request opened webhook received', {
      repository: event.payload.repository.full_name,
      prNumber: event.payload.pull_request.number,
      action: event.payload.action,
    });

    const prData = event.payload as GitHubPullRequestWebhook;

    // Process the PR for potential AI patches or proof verification
    await processPullRequest(prData);
  } catch (error) {
    logger.error('Error processing pull request webhook', error as Error, {
      event: event.payload,
    });
  }
});

webhooks.on('pull_request.synchronize', async event => {
  try {
    logger.info('Pull request synchronized webhook received', {
      repository: event.payload.repository.full_name,
      prNumber: event.payload.pull_request.number,
      action: event.payload.action,
    });

    const prData = event.payload as GitHubPullRequestWebhook;

    // Re-process the PR for updated changes
    await processPullRequest(prData);
  } catch (error) {
    logger.error('Error processing pull request sync webhook', error as Error, {
      event: event.payload,
    });
  }
});

// ============================================================================
// Webhook Processing Functions
// ============================================================================

async function processRelease(
  releaseData: GitHubReleaseWebhook
): Promise<void> {
  const { repository, release } = releaseData;

  try {
    // Check if this is a dependency release
    const isDependencyRelease = await checkIfDependencyRelease(release);

    if (isDependencyRelease) {
      logger.info('Processing dependency release', {
        repository: repository.full_name,
        release: release.tag_name,
        packageName: await extractPackageName(release),
      });

      // Create upgrade job
      await createUpgradeJob(repository.full_name, release);
    }
  } catch (error) {
    logger.error('Error processing release', error as Error, {
      repository: repository.full_name,
      release: release.tag_name,
    });
  }
}

async function processPullRequest(
  prData: GitHubPullRequestWebhook
): Promise<void> {
  const { repository, pull_request } = prData;

  try {
    // Check if this PR contains dependency changes
    const hasDependencyChanges = await checkForDependencyChanges(
      repository.full_name,
      pull_request.number
    );

    if (hasDependencyChanges) {
      logger.info('Processing dependency changes in PR', {
        repository: repository.full_name,
        prNumber: pull_request.number,
      });

      // Create AI patch or proof verification job
      await createAnalysisJob(repository.full_name, pull_request.number);
    }
  } catch (error) {
    logger.error('Error processing pull request', error as Error, {
      repository: repository.full_name,
      prNumber: pull_request.number,
    });
  }
}

async function checkIfDependencyRelease(release: any): Promise<boolean> {
  // Check release title and body for dependency-related keywords
  const dependencyKeywords = [
    'dependency',
    'dependencies',
    'upgrade',
    'update',
    'bump',
    'package',
    'npm',
    'yarn',
    'pnpm',
    'cargo',
    'pip',
    'go.mod',
  ];

  const text = `${release.name} ${release.body}`.toLowerCase();
  return dependencyKeywords.some(keyword => text.includes(keyword));
}

async function extractPackageName(release: any): Promise<string> {
  // Extract package name from release tag or title
  const tagName = release.tag_name;
  const title = release.name;

  // Common patterns for package releases
  const patterns = [
    /^v?(\d+\.\d+\.\d+)$/, // Simple version
    /^([^@]+)@v?(\d+\.\d+\.\d+)$/, // Scoped package
    /^([^@]+)-v?(\d+\.\d+\.\d+)$/, // Package with version
  ];

  for (const pattern of patterns) {
    const match = tagName.match(pattern);
    if (match) {
      return match[1] || 'unknown';
    }
  }

  return 'unknown';
}

async function checkForDependencyChanges(
  repository: string,
  prNumber: number
): Promise<boolean> {
  try {
    // Get PR files and check for dependency files
    const auth = await appAuth({ type: 'app' });
    const octokit = new Octokit({ auth: auth.token });

    const { data: files } = await octokit.pulls.listFiles({
      owner: repository.split('/')[0],
      repo: repository.split('/')[1],
      pull_number: prNumber,
    });

    const dependencyFiles = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'Cargo.toml',
      'Cargo.lock',
      'requirements.txt',
      'pyproject.toml',
      'go.mod',
      'go.sum',
      'Dockerfile',
    ];

    return files.some(file =>
      dependencyFiles.some(depFile => file.filename.includes(depFile))
    );
  } catch (error) {
    logger.error('Error checking for dependency changes', error as Error, {
      repository,
      prNumber,
    });
    return false;
  }
}

async function createUpgradeJob(
  repository: string,
  release: any
): Promise<void> {
  try {
    const jobData = {
      type: 'upgrade',
      repository,
      release: release.tag_name,
      packageName: await extractPackageName(release),
      releaseUrl: release.html_url,
      createdAt: new Date().toISOString(),
    };

    // Store job in Redis queue
    await redis.set(
      `job:upgrade:${Date.now()}`,
      JSON.stringify(jobData),
      3600 // 1 hour TTL
    );

    logger.info('Created upgrade job', jobData);
  } catch (error) {
    logger.error('Error creating upgrade job', error as Error, {
      repository,
      release: release.tag_name,
    });
  }
}

async function createAnalysisJob(
  repository: string,
  prNumber: number
): Promise<void> {
  try {
    const jobData = {
      type: 'analysis',
      repository,
      prNumber,
      createdAt: new Date().toISOString(),
    };

    // Store job in Redis queue
    await redis.set(
      `job:analysis:${Date.now()}`,
      JSON.stringify(jobData),
      3600 // 1 hour TTL
    );

    logger.info('Created analysis job', jobData);
  } catch (error) {
    logger.error('Error creating analysis job', error as Error, {
      repository,
      prNumber,
    });
  }
}

// ============================================================================
// API Routes
// ============================================================================

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthCheck: HealthCheck = {
      status: 'healthy',
      timestamp: new Date(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime() * 1000,
      checks: {
        database: {
          status: (await database.healthCheck()) ? 'healthy' : 'unhealthy',
        },
        redis: {
          status: (await redis.healthCheck()) ? 'healthy' : 'unhealthy',
        },
      },
    };

    const overallStatus = Object.values(healthCheck.checks).every(
      check => check.status === 'healthy'
    )
      ? 'healthy'
      : 'unhealthy';

    healthCheck.status = overallStatus;

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed', error as Error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: 'Health check failed',
    });
  }
});

// Webhook endpoint
app.post('/webhook', verifyWebhookSignature, createNodeMiddleware(webhooks));

// Manual trigger endpoint
app.post(
  '/trigger/upgrade',
  [
    body('repository').isString().notEmpty(),
    body('packageName').isString().notEmpty(),
    body('currentVersion').isString().notEmpty(),
    body('targetVersion').isString().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Invalid request data', errors.array());
      }

      const { repository, packageName, currentVersion, targetVersion } =
        req.body;

      logger.info('Manual upgrade trigger', {
        repository,
        packageName,
        currentVersion,
        targetVersion,
      });

      // Create manual upgrade job
      await createUpgradeJob(repository, {
        tag_name: `${packageName}@${targetVersion}`,
        html_url: `https://github.com/${repository}/releases/tag/${targetVersion}`,
      });

      res.json({
        success: true,
        message: 'Upgrade job created successfully',
      });
    } catch (error) {
      const handledError = ErrorHandler.handleError(
        error,
        logger,
        'manual-upgrade'
      );
      res.status(handledError.statusCode).json({
        error: handledError.message,
        code: handledError.code,
      });
    }
  }
);

// ============================================================================
// Error Handling Middleware
// ============================================================================

app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const handledError = ErrorHandler.handleError(
      error,
      logger,
      'express-error'
    );

    logger.error('Express error handler', handledError, {
      url: req.url,
      method: req.method,
      ip: req.ip,
    });

    res.status(handledError.statusCode).json({
      error: handledError.message,
      code: handledError.code,
      ...(config.isDevelopment() && { stack: handledError.stack }),
    });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
  });
});

// ============================================================================
// Server Startup
// ============================================================================

async function startServer(): Promise<void> {
  try {
    // Connect to database and Redis
    await redis.connect();
    logger.info('Connected to Redis');

    // Test database connection
    await database.healthCheck();
    logger.info('Connected to database');

    // Start server
    const server = app.listen(config.port, () => {
      logger.info('GitHub App server started', {
        port: config.port,
        environment: config.environment,
        version: process.env.npm_package_version || '0.1.0',
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      server.close(async () => {
        await redis.disconnect();
        await database.close();
        logger.info('Server shutdown complete');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      server.close(async () => {
        await redis.disconnect();
        await database.close();
        logger.info('Server shutdown complete');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  logger.error('Unhandled error during startup', error as Error);
  process.exit(1);
});
