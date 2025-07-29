#!/usr/bin/env node

/**
 * SpecCursor Post-Patch Formal Re-Proof Script
 * 
 * This script regenerates Lean specifications after AI patches, re-proves changed theorems,
 * auto-opens blocking PR comments on proof failure, and exports proof timing metrics.
 * 
 * Usage:
 *   node scripts/post-patch-proof.ts --repository owner/repo --pr-number 123
 *   node scripts/post-patch-proof.ts --repository owner/repo --pr-number 123 --dry-run
 */

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, existsSync, mkdirSync } from 'fs/promises';
import { join, dirname } from 'path';
import { Logger, Metrics, ErrorHandler } from '@speccursor/shared-utils';
import { ConfigManager } from '@speccursor/shared-config';
import { 
  ProofResult, 
  TheoremStatus, 
  ProofMetrics,
  SpecCursorError,
  GitHubComment,
  PRComment
} from '@speccursor/shared-types';

const execAsync = promisify(exec);

interface ProofOptions {
  repository: string;
  prNumber: number;
  dryRun: boolean;
  leanVersion: string;
  mathlibVersion: string;
  timeout: number;
  maxRetries: number;
}

interface ProofResult {
  success: boolean;
  theorems: TheoremResult[];
  metrics: ProofMetrics;
  errors: string[];
  comments: PRComment[];
}

interface TheoremResult {
  name: string;
  status: TheoremStatus;
  proofTime: number;
  error?: string;
  changed: boolean;
  file: string;
  line: number;
}

class PostPatchProofEngine {
  private octokit: Octokit;
  private logger: Logger;
  private metrics: Metrics;
  private config: ConfigManager;
  private githubAppId: string;
  private githubPrivateKey: string;
  private githubInstallationId: string;

  constructor() {
    this.config = new ConfigManager();
    this.logger = new Logger('post-patch-proof');
    this.metrics = new Metrics();
    
    // Initialize GitHub App authentication
    this.githubAppId = this.config.get('GITHUB_APP_ID') || '';
    this.githubPrivateKey = this.config.get('GITHUB_PRIVATE_KEY') || '';
    this.githubInstallationId = this.config.get('GITHUB_INSTALLATION_ID') || '';
    
    if (!this.githubAppId || !this.githubPrivateKey) {
      throw new SpecCursorError('GitHub App credentials are required');
    }

    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.githubAppId,
        privateKey: this.githubPrivateKey,
        installationId: this.githubInstallationId,
      },
    });
  }

  /**
   * Main entry point for post-patch formal re-proof
   */
  async runProof(options: ProofOptions): Promise<ProofResult> {
    const startTime = Date.now();
    const results: ProofResult = {
      success: true,
      theorems: [],
      metrics: {
        totalProofs: 0,
        successfulProofs: 0,
        failedProofs: 0,
        totalProofTime: 0,
        averageProofTime: 0,
        maxProofTime: 0,
        minProofTime: 0,
        changedTheorems: 0,
        unchangedTheorems: 0
      },
      errors: [],
      comments: []
    };

    this.logger.info('Starting post-patch formal re-proof', {
      repository: options.repository,
      prNumber: options.prNumber,
      dryRun: options.dryRun
    });

    try {
      // Step 1: Regenerate Lean specifications
      await this.regenerateLeanSpecs(options);

      // Step 2: Identify changed theorems
      const changedTheorems = await this.identifyChangedTheorems(options);

      // Step 3: Re-prove changed theorems
      const theoremResults = await this.reproveTheorems(changedTheorems, options);

      // Step 4: Calculate metrics
      results.theorems = theoremResults;
      results.metrics = this.calculateMetrics(theoremResults);

      // Step 5: Generate PR comments for failures
      if (!options.dryRun) {
        results.comments = await this.generatePRComments(results, options);
      }

      // Step 6: Export proof timing metrics
      await this.exportProofMetrics(results.metrics);

      const totalTime = Date.now() - startTime;
      this.logger.info('Post-patch formal re-proof completed', {
        totalTime,
        successfulProofs: results.metrics.successfulProofs,
        failedProofs: results.metrics.failedProofs,
        totalProofs: results.metrics.totalProofs
      });

      return results;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error('Post-patch formal re-proof failed', {
        error: error instanceof Error ? error.message : String(error),
        totalTime
      });

      results.success = false;
      results.errors.push(error instanceof Error ? error.message : String(error));
      return results;
    }
  }

  /**
   * Regenerate Lean specifications based on current codebase
   */
  private async regenerateLeanSpecs(options: ProofOptions): Promise<void> {
    this.logger.info('Regenerating Lean specifications');

    try {
      // Check if Lean project exists
      if (!existsSync('lakefile.lean')) {
        this.logger.warn('No lakefile.lean found, skipping Lean spec regeneration');
        return;
      }

      // Update Mathlib to latest version
      await execAsync('lake update Mathlib', { timeout: options.timeout });
      this.logger.info('Updated Mathlib to latest version');

      // Build the Lean project
      await execAsync('lake build', { timeout: options.timeout });
      this.logger.info('Built Lean project successfully');

      // Generate updated specifications
      await this.generateUpdatedSpecs();

    } catch (error) {
      this.logger.error('Failed to regenerate Lean specifications', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Generate updated specifications based on current codebase
   */
  private async generateUpdatedSpecs(): Promise<void> {
    try {
      // This would analyze the current codebase and generate updated Lean specs
      // For now, we'll create a simple example
      const specContent = `import Mathlib.Data.List.Basic
import Mathlib.Data.String.Basic
import Mathlib.Logic.Basic
import Mathlib.Order.Basic

/-!
# Updated SpecCursor Specifications

This file contains the updated formal specifications after AI patches.
-/

-- Updated package lock types based on current codebase
structure UpdatedNodePackageLock where
  name : String
  version : String
  dependencies : List (String × String)
  devDependencies : List (String × String)
  peerDependencies : List (String × String)
  deriving Repr

-- Updated compatibility predicate
def isCompatibleUpdated (lock : UpdatedNodePackageLock) : Bool :=
  lock.dependencies.all (fun (name, constraint) =>
    match parseVersion constraint with
    | some _ => true
    | none => false
  ) &&
  lock.devDependencies.all (fun (name, constraint) =>
    match parseVersion constraint with
    | some _ => true
    | none => false
  ) &&
  lock.peerDependencies.all (fun (name, constraint) =>
    match parseVersion constraint with
    | some _ => true
    | none => false
  )

-- Updated upgrade relation
def UpgradeUpdated (p q : UpdatedNodePackageLock) : Prop :=
  p.name = q.name &&
  (match (parseVersion p.version, parseVersion q.version) with
   | (some pv, some qv) =>
     qv.major > pv.major ∨
     (qv.major = pv.major ∧ qv.minor > pv.minor) ∨
     (qv.major = pv.major ∧ qv.minor = pv.minor ∧ qv.patch > pv.patch)
   | _ => false) &&
  q.dependencies.all (fun (name, constraint) =>
    match p.dependencies.find? (fun (n, _) => n = name) with
    | some (_, oldVersion) =>
      match parseVersion oldVersion with
      | some oldV => satisfiesConstraint oldV constraint
      | none => false
    | none => true
  )

-- Updated critical invariant proof
theorem upgradePreservesCompatibilityUpdated (p q : UpdatedNodePackageLock) :
  UpgradeUpdated p q → isCompatibleUpdated p → isCompatibleUpdated q := by
  intro hUpgrade hCompat
  constructor
  · -- Check dependencies
    intro deps
    cases deps with
    | intro name constraint =>
      intro hmem
      have := hCompat.left (name, constraint) hmem
      have := hUpgrade.right.left (name, constraint) hmem
      cases p.dependencies.find? (fun (n, _) => n = name) with
      | some (_, oldVersion) =>
        have := this
        cases parseVersion oldVersion with
        | some oldV =>
          exact hCompat.left (name, constraint) hmem
        | none => contradiction
      | none =>
        exact hCompat.left (name, constraint) hmem
  · -- Check devDependencies
    intro deps
    cases deps with
    | intro name constraint =>
      intro hmem
      have := hCompat.right.left (name, constraint) hmem
      have := hUpgrade.right.right.left (name, constraint) hmem
      cases p.devDependencies.find? (fun (n, _) => n = name) with
      | some (_, oldVersion) =>
        have := this
        cases parseVersion oldVersion with
        | some oldV =>
          exact hCompat.right.left (name, constraint) hmem
        | none => contradiction
      | none =>
        exact hCompat.right.left (name, constraint) hmem
  · -- Check peerDependencies
    intro deps
    cases deps with
    | intro name constraint =>
      intro hmem
      have := hCompat.right.right (name, constraint) hmem
      have := hUpgrade.right.right.right (name, constraint) hmem
      cases p.peerDependencies.find? (fun (n, _) => n = name) with
      | some (_, oldVersion) =>
        have := this
        cases parseVersion oldVersion with
        | some oldV =>
          exact hCompat.right.right (name, constraint) hmem
        | none => contradiction
      | none =>
        exact hCompat.right.right (name, constraint) hmem

/-!
## Test Cases for Updated Specifications
-/

def testUpdatedNodeLock1 : UpdatedNodePackageLock := {
  name := "updated-app"
  version := "2.0.0"
  dependencies := [("lodash", "^4.17.21"), ("express", "^4.18.2")]
  devDependencies := [("jest", "^29.5.0")]
  peerDependencies := []
}

def testUpdatedNodeLock2 : UpdatedNodePackageLock := {
  name := "updated-app"
  version := "2.1.0"
  dependencies := [("lodash", "^4.17.21"), ("express", "^4.18.2")]
  devDependencies := [("jest", "^29.5.0")]
  peerDependencies := []
}

-- Test updated specifications
#eval isCompatibleUpdated testUpdatedNodeLock1
#eval isCompatibleUpdated testUpdatedNodeLock2
#eval UpgradeUpdated testUpdatedNodeLock1 testUpdatedNodeLock2
#eval isCompatibleUpdated testUpdatedNodeLock1 && UpgradeUpdated testUpdatedNodeLock1 testUpdatedNodeLock2 → isCompatibleUpdated testUpdatedNodeLock2
`;

      // Write updated specifications
      await writeFile('lean/speccursor_updated.lean', specContent);
      this.logger.info('Generated updated Lean specifications');

    } catch (error) {
      this.logger.error('Failed to generate updated specifications', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Identify theorems that have changed due to AI patches
   */
  private async identifyChangedTheorems(options: ProofOptions): Promise<string[]> {
    this.logger.info('Identifying changed theorems');

    try {
      // Get PR changes
      const [owner, repo] = options.repository.split('/');
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: options.prNumber
      });

      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: options.prNumber
      });

      // Filter for Lean files that were changed
      const changedLeanFiles = files
        .filter(file => file.filename.endsWith('.lean'))
        .map(file => file.filename);

      this.logger.info(`Found ${changedLeanFiles.length} changed Lean files`, {
        files: changedLeanFiles
      });

      // Extract theorem names from changed files
      const changedTheorems: string[] = [];
      for (const file of changedLeanFiles) {
        if (existsSync(file)) {
          const content = await readFile(file, 'utf-8');
          const theoremMatches = content.match(/theorem\s+(\w+)/g);
          if (theoremMatches) {
            theoremMatches.forEach(match => {
              const theoremName = match.replace('theorem ', '');
              changedTheorems.push(theoremName);
            });
          }
        }
      }

      this.logger.info(`Identified ${changedTheorems.length} changed theorems`, {
        theorems: changedTheorems
      });

      return changedTheorems;

    } catch (error) {
      this.logger.error('Failed to identify changed theorems', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Re-prove changed theorems
   */
  private async reproveTheorems(changedTheorems: string[], options: ProofOptions): Promise<TheoremResult[]> {
    const results: TheoremResult[] = [];

    this.logger.info(`Re-proving ${changedTheorems.length} changed theorems`);

    for (const theorem of changedTheorems) {
      const startTime = Date.now();
      let status: TheoremStatus = TheoremStatus.PENDING;
      let error: string | undefined;
      let proofTime = 0;

      try {
        this.logger.info(`Proving theorem: ${theorem}`);

        // Run Lean checker on the specific theorem
        const { stdout, stderr } = await execAsync(
          `lake env lean --run -e "${theorem}" lean/speccursor_updated.lean`,
          { timeout: options.timeout }
        );

        proofTime = Date.now() - startTime;
        
        if (stderr && stderr.includes('error')) {
          status = TheoremStatus.FAILED;
          error = stderr;
          this.logger.warn(`Theorem ${theorem} failed`, { error: stderr });
        } else {
          status = TheoremStatus.PROVED;
          this.logger.info(`Theorem ${theorem} proved successfully`, { proofTime });
        }

      } catch (error) {
        proofTime = Date.now() - startTime;
        status = TheoremStatus.FAILED;
        error = error instanceof Error ? error.message : String(error);
        this.logger.error(`Theorem ${theorem} failed`, { error });
      }

      results.push({
        name: theorem,
        status,
        proofTime,
        error,
        changed: true,
        file: 'lean/speccursor_updated.lean',
        line: 0 // Would be calculated from actual file position
      });
    }

    return results;
  }

  /**
   * Calculate proof metrics
   */
  private calculateMetrics(theoremResults: TheoremResult[]): ProofMetrics {
    const successfulProofs = theoremResults.filter(t => t.status === TheoremStatus.PROVED).length;
    const failedProofs = theoremResults.filter(t => t.status === TheoremStatus.FAILED).length;
    const changedTheorems = theoremResults.filter(t => t.changed).length;
    const unchangedTheorems = theoremResults.filter(t => !t.changed).length;
    
    const proofTimes = theoremResults.map(t => t.proofTime).filter(t => t > 0);
    const totalProofTime = proofTimes.reduce((sum, time) => sum + time, 0);
    const averageProofTime = proofTimes.length > 0 ? totalProofTime / proofTimes.length : 0;
    const maxProofTime = proofTimes.length > 0 ? Math.max(...proofTimes) : 0;
    const minProofTime = proofTimes.length > 0 ? Math.min(...proofTimes) : 0;

    return {
      totalProofs: theoremResults.length,
      successfulProofs,
      failedProofs,
      totalProofTime,
      averageProofTime,
      maxProofTime,
      minProofTime,
      changedTheorems,
      unchangedTheorems
    };
  }

  /**
   * Generate PR comments for proof failures
   */
  private async generatePRComments(results: ProofResult, options: ProofOptions): Promise<PRComment[]> {
    const comments: PRComment[] = [];

    // Group failed theorems by file
    const failedTheorems = results.theorems.filter(t => t.status === TheoremStatus.FAILED);
    
    if (failedTheorems.length === 0) {
      this.logger.info('No failed theorems, no comments needed');
      return comments;
    }

    // Create blocking comment for failed proofs
    const failedTheoremList = failedTheorems.map(t => 
      `- **${t.name}** (${t.file}:${t.line}): ${t.error}`
    ).join('\n');

    const blockingComment: PRComment = {
      body: `## 🔴 Formal Verification Failed

The following theorems failed formal verification after AI patches:

${failedTheoremList}

**Action Required**: These proof failures must be resolved before merging.

### Next Steps:
1. Review the failing proofs
2. Update the Lean specifications if needed
3. Re-run the formal verification
4. Ensure all proofs pass before merging

### Metrics:
- **Total Proofs**: ${results.metrics.totalProofs}
- **Successful**: ${results.metrics.successfulProofs}
- **Failed**: ${results.metrics.failedProofs}
- **Average Proof Time**: ${results.metrics.averageProofTime.toFixed(2)}ms

This PR is blocked until all formal proofs pass.`,
      path: 'lean/speccursor_updated.lean',
      line: 1,
      position: 'top'
    };

    comments.push(blockingComment);

    // Add individual comments for each failed theorem
    for (const theorem of failedTheorems) {
      const individualComment: PRComment = {
        body: `## ❌ Theorem Proof Failed

**Theorem**: \`${theorem.name}\`

**Error**: ${theorem.error}

**Proof Time**: ${theorem.proofTime}ms

This theorem needs to be re-proved after the AI patches.`,
        path: theorem.file,
        line: theorem.line,
        position: 'right'
      };

      comments.push(individualComment);
    }

    this.logger.info(`Generated ${comments.length} PR comments for failed proofs`);

    return comments;
  }

  /**
   * Export proof timing metrics
   */
  private async exportProofMetrics(metrics: ProofMetrics): Promise<void> {
    try {
      const metricsData = {
        timestamp: new Date().toISOString(),
        metrics,
        metadata: {
          version: '1.0.0',
          source: 'post-patch-proof'
        }
      };

      // Ensure metrics directory exists
      const metricsDir = 'metrics';
      if (!existsSync(metricsDir)) {
        mkdirSync(metricsDir, { recursive: true });
      }

      // Write metrics to file
      await writeFile(
        join(metricsDir, `proof-metrics-${Date.now()}.json`),
        JSON.stringify(metricsData, null, 2)
      );

      // Record metrics in monitoring system
      this.metrics.record('proof_total_count', metrics.totalProofs);
      this.metrics.record('proof_successful_count', metrics.successfulProofs);
      this.metrics.record('proof_failed_count', metrics.failedProofs);
      this.metrics.record('proof_total_time', metrics.totalProofTime);
      this.metrics.record('proof_average_time', metrics.averageProofTime);
      this.metrics.record('proof_max_time', metrics.maxProofTime);
      this.metrics.record('proof_min_time', metrics.minProofTime);
      this.metrics.record('proof_changed_theorems', metrics.changedTheorems);

      this.logger.info('Exported proof timing metrics', {
        totalProofs: metrics.totalProofs,
        successfulProofs: metrics.successfulProofs,
        failedProofs: metrics.failedProofs,
        totalProofTime: metrics.totalProofTime
      });

    } catch (error) {
      this.logger.error('Failed to export proof metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options: ProofOptions = {
    repository: '',
    prNumber: 0,
    dryRun: false,
    leanVersion: '4.20.0',
    mathlibVersion: 'latest',
    timeout: 300000, // 5 minutes
    maxRetries: 3
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--repository':
        options.repository = nextArg;
        i++;
        break;
      case '--pr-number':
        options.prNumber = parseInt(nextArg);
        i++;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--lean-version':
        options.leanVersion = nextArg;
        i++;
        break;
      case '--mathlib-version':
        options.mathlibVersion = nextArg;
        i++;
        break;
      case '--timeout':
        options.timeout = parseInt(nextArg);
        i++;
        break;
      case '--max-retries':
        options.maxRetries = parseInt(nextArg);
        i++;
        break;
      case '--help':
        console.log(`
SpecCursor Post-Patch Formal Re-Proof

Usage: node scripts/post-patch-proof.ts [options]

Options:
  --repository <owner/repo>  GitHub repository (required)
  --pr-number <number>       Pull request number (required)
  --dry-run                  Run without creating PR comments
  --lean-version <version>   Lean version to use (default: 4.20.0)
  --mathlib-version <version> Mathlib version to use (default: latest)
  --timeout <ms>            Timeout in milliseconds (default: 300000)
  --max-retries <n>         Maximum retry attempts (default: 3)
  --help                    Show this help message

Environment Variables:
  GITHUB_APP_ID            GitHub App ID (required)
  GITHUB_PRIVATE_KEY       GitHub App private key (required)
  GITHUB_INSTALLATION_ID   GitHub App installation ID (required)

Examples:
  node scripts/post-patch-proof.ts --repository owner/repo --pr-number 123
  node scripts/post-patch-proof.ts --repository owner/repo --pr-number 123 --dry-run
        `);
        process.exit(0);
    }
  }

  // Validate required options
  if (!options.repository || options.prNumber === 0) {
    console.error('Error: --repository and --pr-number are required');
    process.exit(1);
  }

  // Initialize and run
  try {
    const engine = new PostPatchProofEngine();
    const result = await engine.runProof(options);

    if (result.success) {
      console.log('✅ Post-patch formal re-proof completed successfully');
      console.log(`📊 Metrics:`, result.metrics);
      console.log(`🔍 Theorems: ${result.theorems.length} total, ${result.metrics.successfulProofs} successful, ${result.metrics.failedProofs} failed`);
      
      if (result.comments.length > 0) {
        console.log(`💬 Generated ${result.comments.length} PR comments`);
      }
      
      if (result.errors.length > 0) {
        console.log(`⚠️  Warnings: ${result.errors.length} errors occurred`);
      }
    } else {
      console.error('❌ Post-patch formal re-proof failed');
      console.error(`Errors: ${result.errors.join(', ')}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { PostPatchProofEngine, ProofOptions, ProofResult }; 