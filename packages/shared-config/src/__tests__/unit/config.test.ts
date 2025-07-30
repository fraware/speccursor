import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigManager } from '../../index';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // Clean up any test configurations
    configManager.clear();
  });

  describe('environment configuration', () => {
    it('should load default environment configuration', () => {
      const config = configManager.getEnvironmentConfig();

      expect(config).toBeDefined();
      expect(config.node).toBeDefined();
      expect(config.rust).toBeDefined();
      expect(config.go).toBeDefined();
      expect(config.python).toBeDefined();
      expect(config.lean).toBeDefined();
    });

    it('should validate environment configuration', () => {
      const config = configManager.getEnvironmentConfig();

      expect(config.node.versions).toContain(18);
      expect(config.node.versions).toContain(20);
      expect(config.rust.versions).toContain('1.78');
      expect(config.rust.versions).toContain('nightly');
      expect(config.go.versions).toContain('1.22');
      expect(config.python.versions).toContain('3.12');
      expect(config.lean.versions).toContain('4.20.0');
    });

    it('should handle environment overrides', () => {
      process.env.NODE_VERSION = '20';
      process.env.RUST_VERSION = '1.78';

      const config = configManager.getEnvironmentConfig();

      expect(config.node.current).toBe('20');
      expect(config.rust.current).toBe('1.78');

      // Clean up
      delete process.env.NODE_VERSION;
      delete process.env.RUST_VERSION;
    });
  });

  describe('security configuration', () => {
    it('should load security configuration', () => {
      const config = configManager.getSecurityConfig();

      expect(config).toBeDefined();
      expect(config.sandbox).toBeDefined();
      expect(config.rateLimiting).toBeDefined();
      expect(config.vulnerabilityScanning).toBeDefined();
    });

    it('should validate security settings', () => {
      const config = configManager.getSecurityConfig();

      expect(config.sandbox.enabled).toBe(true);
      expect(config.rateLimiting.enabled).toBe(true);
      expect(config.vulnerabilityScanning.enabled).toBe(true);
      expect(config.sandbox.maxExecutionTime).toBeGreaterThan(0);
      expect(config.rateLimiting.maxRequestsPerMinute).toBeGreaterThan(0);
    });
  });

  describe('observability configuration', () => {
    it('should load observability configuration', () => {
      const config = configManager.getObservabilityConfig();

      expect(config).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.metrics).toBeDefined();
      expect(config.tracing).toBeDefined();
    });

    it('should validate observability settings', () => {
      const config = configManager.getObservabilityConfig();

      expect(config.logging.level).toBeDefined();
      expect(config.metrics.enabled).toBe(true);
      expect(config.tracing.enabled).toBe(true);
      expect(config.logging.format).toBe('json');
    });
  });

  describe('AI configuration', () => {
    it('should load AI configuration', () => {
      const config = configManager.getAIConfig();

      expect(config).toBeDefined();
      expect(config.claude).toBeDefined();
      expect(config.prompting).toBeDefined();
    });

    it('should validate AI settings', () => {
      const config = configManager.getAIConfig();

      expect(config.claude.model).toBeDefined();
      expect(config.claude.maxTokens).toBeGreaterThan(0);
      expect(config.prompting.maxRetries).toBeGreaterThan(0);
    });
  });

  describe('database configuration', () => {
    it('should load database configuration', () => {
      const config = configManager.getDatabaseConfig();

      expect(config).toBeDefined();
      expect(config.postgres).toBeDefined();
      expect(config.redis).toBeDefined();
    });

    it('should validate database settings', () => {
      const config = configManager.getDatabaseConfig();

      expect(config.postgres.host).toBeDefined();
      expect(config.postgres.port).toBeGreaterThan(0);
      expect(config.redis.host).toBeDefined();
      expect(config.redis.port).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should validate all configurations', () => {
      const isValid = configManager.validateAll();
      expect(isValid).toBe(true);
    });

    it('should handle invalid configurations', () => {
      // Mock invalid configuration
      const originalConfig = configManager.getEnvironmentConfig();
      configManager.setEnvironmentConfig({
        ...originalConfig,
        node: { versions: [] },
      });

      const isValid = configManager.validateAll();
      expect(isValid).toBe(false);
    });
  });

  describe('reloading', () => {
    it('should reload configurations', () => {
      const originalConfig = configManager.getEnvironmentConfig();
      const reloadedConfig = configManager.reload();

      expect(reloadedConfig).toEqual(originalConfig);
    });
  });
});
