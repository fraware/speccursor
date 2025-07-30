import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpgradeService } from '../../../apps/github-app/src/services/upgrade';
import { Database } from '../../../packages/shared-utils/src/index';
import {
  Upgrade,
  Ecosystem,
  UpgradeStatus,
} from '../../../packages/shared-types/src/index';

// Mock dependencies
jest.mock('../../../packages/shared-utils/src/index');
jest.mock('../../../packages/shared-config/src/index');

const mockDatabase = {
  query: jest.fn(),
  getClient: jest.fn(),
  close: jest.fn(),
  healthCheck: jest.fn(),
} as jest.Mocked<Database>;

describe('UpgradeService', () => {
  let upgradeService: UpgradeService;

  beforeEach(() => {
    jest.clearAllMocks();
    upgradeService = new UpgradeService(mockDatabase);
  });

  describe('createUpgrade', () => {
    it('should create a new upgrade successfully', async () => {
      const mockUpgrade: Upgrade = {
        id: 'test-id',
        repository: 'test/repo',
        ecosystem: Ecosystem.NODE,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
        status: UpgradeStatus.PENDING,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.query.mockResolvedValue([mockUpgrade]);

      const result = await upgradeService.createUpgrade({
        repository: 'test/repo',
        ecosystem: Ecosystem.NODE,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpgrade);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO upgrades'),
        expect.arrayContaining([
          'test/repo',
          'node',
          'test-package',
          '1.0.0',
          '2.0.0',
        ])
      );
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      const result = await upgradeService.createUpgrade({
        repository: 'test/repo',
        ecosystem: Ecosystem.NODE,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Database error');
    });

    it('should validate input parameters', async () => {
      const result = await upgradeService.createUpgrade({
        repository: '',
        ecosystem: Ecosystem.NODE,
        packageName: '',
        currentVersion: 'invalid',
        targetVersion: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Invalid input');
    });
  });

  describe('getUpgrade', () => {
    it('should retrieve an upgrade by ID', async () => {
      const mockUpgrade: Upgrade = {
        id: 'test-id',
        repository: 'test/repo',
        ecosystem: Ecosystem.NODE,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
        status: UpgradeStatus.COMPLETED,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      };

      mockDatabase.query.mockResolvedValue([mockUpgrade]);

      const result = await upgradeService.getUpgrade('test-id');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpgrade);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM upgrades WHERE id = $1'),
        ['test-id']
      );
    });

    it('should return not found for non-existent upgrade', async () => {
      mockDatabase.query.mockResolvedValue([]);

      const result = await upgradeService.getUpgrade('non-existent');

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('not found');
    });
  });

  describe('listUpgrades', () => {
    it('should list upgrades with pagination', async () => {
      const mockUpgrades: Upgrade[] = [
        {
          id: 'test-1',
          repository: 'test/repo',
          ecosystem: Ecosystem.NODE,
          packageName: 'test-package',
          currentVersion: '1.0.0',
          targetVersion: '2.0.0',
          status: UpgradeStatus.COMPLETED,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test-2',
          repository: 'test/repo',
          ecosystem: Ecosystem.RUST,
          packageName: 'test-package-2',
          currentVersion: '1.0.0',
          targetVersion: '2.0.0',
          status: UpgradeStatus.PENDING,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDatabase.query.mockResolvedValueOnce(mockUpgrades);
      mockDatabase.query.mockResolvedValueOnce([{ count: '2' }]);

      const result = await upgradeService.listUpgrades({
        repository: 'test/repo',
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data.upgrades).toHaveLength(2);
      expect(result.data.total).toBe(2);
    });

    it('should filter by ecosystem', async () => {
      const mockUpgrades: Upgrade[] = [
        {
          id: 'test-1',
          repository: 'test/repo',
          ecosystem: Ecosystem.NODE,
          packageName: 'test-package',
          currentVersion: '1.0.0',
          targetVersion: '2.0.0',
          status: UpgradeStatus.COMPLETED,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDatabase.query.mockResolvedValueOnce(mockUpgrades);
      mockDatabase.query.mockResolvedValueOnce([{ count: '1' }]);

      const result = await upgradeService.listUpgrades({
        ecosystem: Ecosystem.NODE,
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data.upgrades).toHaveLength(1);
      expect(result.data.upgrades[0].ecosystem).toBe(Ecosystem.NODE);
    });
  });

  describe('updateUpgradeStatus', () => {
    it('should update upgrade status successfully', async () => {
      mockDatabase.query.mockResolvedValue([{ updated_at: new Date() }]);

      const result = await upgradeService.updateUpgradeStatus(
        'test-id',
        UpgradeStatus.COMPLETED
      );

      expect(result.success).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE upgrades SET status = $1'),
        [UpgradeStatus.COMPLETED, 'test-id']
      );
    });

    it('should handle status update errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Update failed'));

      const result = await upgradeService.updateUpgradeStatus(
        'test-id',
        UpgradeStatus.FAILED
      );

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Update failed');
    });
  });

  describe('validateVersion', () => {
    it('should validate semantic versions', () => {
      expect(upgradeService.validateVersion('1.0.0')).toBe(true);
      expect(upgradeService.validateVersion('2.1.3')).toBe(true);
      expect(upgradeService.validateVersion('invalid')).toBe(false);
      expect(upgradeService.validateVersion('1.0')).toBe(false);
    });
  });

  describe('calculateUpgradeRisk', () => {
    it('should calculate risk for major version upgrade', () => {
      const risk = upgradeService.calculateUpgradeRisk('1.0.0', '2.0.0');
      expect(risk).toBe('high');
    });

    it('should calculate risk for minor version upgrade', () => {
      const risk = upgradeService.calculateUpgradeRisk('1.0.0', '1.1.0');
      expect(risk).toBe('medium');
    });

    it('should calculate risk for patch version upgrade', () => {
      const risk = upgradeService.calculateUpgradeRisk('1.0.0', '1.0.1');
      expect(risk).toBe('low');
    });
  });

  describe('checkCompatibility', () => {
    it('should check package compatibility', async () => {
      const compatibility = await upgradeService.checkCompatibility(
        Ecosystem.NODE,
        'test-package',
        '1.0.0',
        '2.0.0'
      );

      expect(compatibility.compatible).toBeDefined();
      expect(compatibility.breakingChanges).toBeDefined();
    });
  });

  describe('generateUpgradePlan', () => {
    it('should generate upgrade plan', async () => {
      const plan = await upgradeService.generateUpgradePlan({
        repository: 'test/repo',
        ecosystem: Ecosystem.NODE,
        packageName: 'test-package',
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
      });

      expect(plan.steps).toBeDefined();
      expect(plan.estimatedDuration).toBeDefined();
      expect(plan.risks).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should perform health check', async () => {
      mockDatabase.healthCheck.mockResolvedValue(true);

      const health = await upgradeService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.database).toBe(true);
    });

    it('should report unhealthy when database is down', async () => {
      mockDatabase.healthCheck.mockResolvedValue(false);

      const health = await upgradeService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.database).toBe(false);
    });
  });
});
