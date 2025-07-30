import { z } from 'zod';
import {
  UpgradeSchema,
  ProofSchema,
  AIPatchSchema,
  JobSchema,
  MetricSchema,
  AuditLogSchema,
  SystemConfigSchema,
  Ecosystem,
  UpgradeStatus,
  ProofStatus,
  PatchStatus,
  JobStatus,
  MetricType,
  Upgrade,
  Proof,
  AIPatch,
  Job,
  Metric,
  AuditLog,
  SystemConfig,
} from '../../index';

describe('Shared Types Unit Tests', () => {
  describe('Ecosystem Enum', () => {
    it('should have correct ecosystem values', () => {
      expect(Ecosystem.NODE).toBe('node');
      expect(Ecosystem.RUST).toBe('rust');
      expect(Ecosystem.PYTHON).toBe('python');
      expect(Ecosystem.GO).toBe('go');
      expect(Ecosystem.LEAN).toBe('lean');
    });
  });

  describe('Status Enums', () => {
    it('should have correct upgrade status values', () => {
      expect(UpgradeStatus.PENDING).toBe('pending');
      expect(UpgradeStatus.PROCESSING).toBe('processing');
      expect(UpgradeStatus.COMPLETED).toBe('completed');
      expect(UpgradeStatus.FAILED).toBe('failed');
      expect(UpgradeStatus.CANCELLED).toBe('cancelled');
    });

    it('should have correct proof status values', () => {
      expect(ProofStatus.PENDING).toBe('pending');
      expect(ProofStatus.VERIFYING).toBe('verifying');
      expect(ProofStatus.VERIFIED).toBe('verified');
      expect(ProofStatus.FAILED).toBe('failed');
      expect(ProofStatus.TIMEOUT).toBe('timeout');
    });

    it('should have correct patch status values', () => {
      expect(PatchStatus.PENDING).toBe('pending');
      expect(PatchStatus.GENERATING).toBe('generating');
      expect(PatchStatus.COMPLETED).toBe('completed');
      expect(PatchStatus.FAILED).toBe('failed');
      expect(PatchStatus.REJECTED).toBe('rejected');
    });

    it('should have correct job status values', () => {
      expect(JobStatus.PENDING).toBe('pending');
      expect(JobStatus.PROCESSING).toBe('processing');
      expect(JobStatus.COMPLETED).toBe('completed');
      expect(JobStatus.FAILED).toBe('failed');
      expect(JobStatus.CANCELLED).toBe('cancelled');
    });
  });

  describe('MetricType Enum', () => {
    it('should have correct metric type values', () => {
      expect(MetricType.COUNTER).toBe('counter');
      expect(MetricType.GAUGE).toBe('gauge');
      expect(MetricType.HISTOGRAM).toBe('histogram');
      expect(MetricType.SUMMARY).toBe('summary');
    });
  });

  describe('Upgrade Schema', () => {
    it('should validate valid upgrade data', () => {
      const validUpgrade = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repository: 'test/repo',
        ecosystem: 'node' as const,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
        status: 'pending' as const,
        metadata: { key: 'value' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
      };

      const result = UpgradeSchema.safeParse(validUpgrade);
      expect(result.success).toBe(true);
    });

    it('should reject invalid upgrade data', () => {
      const invalidUpgrade = {
        id: 'invalid-uuid',
        repository: '',
        ecosystem: 'invalid-ecosystem',
        packageName: '',
        currentVersion: '',
        targetVersion: '',
        status: 'invalid-status',
      };

      const result = UpgradeSchema.safeParse(invalidUpgrade);
      expect(result.success).toBe(false);
    });
  });

  describe('Proof Schema', () => {
    it('should validate valid proof data', () => {
      const validProof = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        upgradeId: '123e4567-e89b-12d3-a456-426614174000',
        proofType: 'invariant' as const,
        status: 'pending' as const,
        leanCode: 'example lean code',
        proofResult: { verified: true },
        verificationTimeMs: 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
      };

      const result = ProofSchema.safeParse(validProof);
      expect(result.success).toBe(true);
    });
  });

  describe('AIPatch Schema', () => {
    it('should validate valid AI patch data', () => {
      const validPatch = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        upgradeId: '123e4567-e89b-12d3-a456-426614174000',
        patchType: 'regression_fix' as const,
        status: 'pending' as const,
        originalCode: 'original code',
        patchedCode: 'patched code',
        diffOutput: 'diff output',
        confidenceScore: 0.95,
        claudeRequest: { prompt: 'test' },
        claudeResponse: { response: 'test' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
      };

      const result = AIPatchSchema.safeParse(validPatch);
      expect(result.success).toBe(true);
    });

    it('should validate confidence score range', () => {
      const patchWithInvalidScore = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        upgradeId: '123e4567-e89b-12d3-a456-426614174000',
        patchType: 'ai-generated',
        status: 'pending' as const,
        confidenceScore: 1.5, // Invalid: should be 0-1
      };

      const result = AIPatchSchema.safeParse(patchWithInvalidScore);
      expect(result.success).toBe(false);
    });
  });

  describe('Job Schema', () => {
    it('should validate valid job data', () => {
      const validJob = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'upgrade' as const,
        status: 'pending' as const,
        priority: 1,
        data: { test: 'data' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
      };

      const result = JobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
    });
  });

  describe('Metric Schema', () => {
    it('should validate valid metric data', () => {
      const validMetric = {
        name: 'upgrade_duration_seconds',
        value: 1.5,
        type: 'gauge' as const,
        labels: { service: 'controller' },
        timestamp: new Date().toISOString(),
      };

      const result = MetricSchema.safeParse(validMetric);
      expect(result.success).toBe(true);
    });
  });

  describe('AuditLog Schema', () => {
    it('should validate valid audit log data', () => {
      const validAuditLog = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'upgrade_created',
        resourceType: 'upgrade',
        resourceId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user123',
        metadata: { key: 'value' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        timestamp: new Date().toISOString(),
      };

      const result = AuditLogSchema.safeParse(validAuditLog);
      expect(result.success).toBe(true);
    });
  });

  describe('SystemConfig Schema', () => {
    it('should validate valid system config data', () => {
      const validConfig = {
        port: 3000,
        environment: 'development',
        database: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
          ssl: false,
          maxConnections: 10,
          idleTimeout: 300,
        },
        redis: {
          host: 'localhost',
          port: 6379,
          password: undefined,
          db: 0,
          keyPrefix: 'test:',
        },
        monitoring: {
          metricsEnabled: true,
          tracingEnabled: false,
          logLevel: 'info',
          prometheusPort: 9090,
          jaegerEndpoint: undefined,
        },
      };

      const result = SystemConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify ecosystem types', () => {
      expect(Ecosystem.NODE).toBe('node');
      expect(Ecosystem.RUST).toBe('rust');
      expect(Ecosystem.PYTHON).toBe('python');
      expect(Ecosystem.GO).toBe('go');
      expect(Ecosystem.LEAN).toBe('lean');
    });

    it('should correctly identify status types', () => {
      expect(UpgradeStatus.PENDING).toBe('pending');
      expect(ProofStatus.VERIFIED).toBe('verified');
      expect(PatchStatus.COMPLETED).toBe('completed');
      expect(JobStatus.COMPLETED).toBe('completed');
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should handle null values appropriately', () => {
      const upgradeWithNulls = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repository: 'test/repo',
        ecosystem: 'node' as const,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
        status: 'pending' as const,
        metadata: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
      };

      const result = UpgradeSchema.safeParse(upgradeWithNulls);
      expect(result.success).toBe(true);
    });

    it('should handle empty strings appropriately', () => {
      const upgradeWithEmptyStrings = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repository: 'test/repo',
        ecosystem: 'node' as const,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
        status: 'pending' as const,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: '',
      };

      const result = UpgradeSchema.safeParse(upgradeWithEmptyStrings);
      expect(result.success).toBe(true);
    });
  });
});
