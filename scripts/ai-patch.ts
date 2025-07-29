#!/usr/bin/env node

/**
 * SpecCursor AI Patch Generation Script
 * 
 * This script uses Anthropic's Claude-Sonnet-4 to generate patches for failing tests,
 * applies them using Morph's API, and handles failures with comprehensive logging.
 * 
 * Usage:
 *   node scripts/ai-patch.ts --test-output test-results.json --ecosystem node
 *   node scripts/ai-patch.ts --test-output test-results.json --ecosystem rust --dry-run
 */

import { Anthropic } from '@anthropic-ai/sdk';
import axios from 'axios';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Logger, Metrics, ErrorHandler } from '@speccursor/shared-utils';
import { ConfigManager } from '@speccursor/shared-config';
import { 
  AIPatchRequest, 
  AIPatchResponse, 
  TestResult, 
  Ecosystem,
  PatchStatus,
  SpecCursorError 
} from '@speccursor/shared-types';

const execAsync = promisify(exec);

interface PatchOptions {
  testOutputPath: string;
  ecosystem: Ecosystem;
  dryRun: boolean;
  maxRetries: number;
  timeout: number;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface PatchResult {
  success: boolean;
  patch?: string;
  error?: string;
  applied?: boolean;
  testResults?: TestResult[];
  metrics: {
    generationTime: number;
    applicationTime: number;
    totalTime: number;
    tokensUsed: number;
    retries: number;
  };
}

class AIPatchGenerator {
  private anthropic: Anthropic;
  private logger: Logger;
  private metrics: Metrics;
  private config: ConfigManager;
  private morphApiKey: string;
  private morphApiUrl: string;

  constructor() {
    this.config = new ConfigManager();
    this.logger = new Logger('ai-patch-generator');
    this.metrics = new Metrics();
    
    // Initialize Anthropic client
    const anthropicApiKey = this.config.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new SpecCursorError('ANTHROPIC_API_KEY is required');
    }
    
    this.anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    // Initialize Morph API configuration
    this.morphApiKey = this.config.get('MORPH_API_KEY') || '';
    this.morphApiUrl = this.config.get('MORPH_API_URL') || 'https://api.morph.dev';
  }

  /**
   * Main entry point for AI patch generation
   */
  async generatePatch(options: PatchOptions): Promise<PatchResult> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: string | undefined;

    this.logger.info('Starting AI patch generation', {
      ecosystem: options.ecosystem,
      testOutputPath: options.testOutputPath,
      dryRun: options.dryRun
    });

    try {
      // Load test results
      const testResults = await this.loadTestResults(options.testOutputPath);
      if (!testResults || testResults.length === 0) {
        throw new SpecCursorError('No test results found');
      }

      // Filter failing tests
      const failingTests = testResults.filter(test => !test.passed);
      if (failingTests.length === 0) {
        this.logger.info('No failing tests found, skipping patch generation');
        return {
          success: true,
          metrics: {
            generationTime: 0,
            applicationTime: 0,
            totalTime: Date.now() - startTime,
            tokensUsed: 0,
            retries: 0
          }
        };
      }

      this.logger.info(`Found ${failingTests.length} failing tests`, {
        failingTests: failingTests.map(t => t.name)
      });

      // Generate patch with retries
      let patch: string | undefined;
      while (retries < options.maxRetries && !patch) {
        try {
          patch = await this.generatePatchWithClaude(failingTests, options);
          break;
        } catch (error) {
          retries++;
          lastError = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Patch generation attempt ${retries} failed`, { error: lastError });
          
          if (retries < options.maxRetries) {
            await this.delay(1000 * retries); // Exponential backoff
          }
        }
      }

      if (!patch) {
        throw new SpecCursorError(`Failed to generate patch after ${options.maxRetries} attempts: ${lastError}`);
      }

      const generationTime = Date.now() - startTime;
      this.logger.info('Patch generated successfully', { generationTime });

      // Apply patch if not in dry-run mode
      let applied = false;
      let applicationTime = 0;
      if (!options.dryRun) {
        const applyStartTime = Date.now();
        applied = await this.applyPatchWithMorph(patch, options.ecosystem);
        applicationTime = Date.now() - applyStartTime;
        
        if (applied) {
          this.logger.info('Patch applied successfully');
        } else {
          this.logger.warn('Patch application failed');
        }
      } else {
        this.logger.info('Dry-run mode: patch not applied');
      }

      // Re-run tests to validate patch
      const testResultsAfterPatch = await this.runTestsAfterPatch(options.ecosystem);

      const totalTime = Date.now() - startTime;
      const metrics = {
        generationTime,
        applicationTime,
        totalTime,
        tokensUsed: 0, // Would be updated from Claude response
        retries
      };

      this.metrics.record('ai_patch_generation_time', generationTime);
      this.metrics.record('ai_patch_application_time', applicationTime);
      this.metrics.record('ai_patch_total_time', totalTime);
      this.metrics.record('ai_patch_retries', retries);
      this.metrics.record('ai_patch_success', applied ? 1 : 0);

      return {
        success: true,
        patch,
        applied,
        testResults: testResultsAfterPatch,
        metrics
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error('AI patch generation failed', { 
        error: error instanceof Error ? error.message : String(error),
        totalTime,
        retries
      });

      this.metrics.record('ai_patch_failure', 1);
      this.metrics.record('ai_patch_total_time', totalTime);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          generationTime: 0,
          applicationTime: 0,
          totalTime,
          tokensUsed: 0,
          retries
        }
      };
    }
  }

  /**
   * Load test results from file
   */
  private async loadTestResults(testOutputPath: string): Promise<TestResult[]> {
    try {
      if (!existsSync(testOutputPath)) {
        throw new SpecCursorError(`Test output file not found: ${testOutputPath}`);
      }

      const content = await readFile(testOutputPath, 'utf-8');
      const testResults = JSON.parse(content) as TestResult[];
      
      this.logger.info(`Loaded ${testResults.length} test results`);
      return testResults;
    } catch (error) {
      throw new SpecCursorError(`Failed to load test results: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate patch using Claude-Sonnet-4
   */
  private async generatePatchWithClaude(failingTests: TestResult[], options: PatchOptions): Promise<string> {
    const prompt = this.buildPrompt(failingTests, options.ecosystem);
    
    this.logger.info('Generating patch with Claude', {
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });

    const response = await this.anthropic.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const patch = response.content[0]?.type === 'text' ? response.content[0].text : '';
    
    if (!patch) {
      throw new SpecCursorError('No patch generated by Claude');
    }

    // Extract patch from response (assuming it's wrapped in code blocks)
    const patchMatch = patch.match(/```(?:diff|patch)?\n([\s\S]*?)\n```/);
    const extractedPatch = patchMatch ? patchMatch[1] : patch;

    this.logger.info('Patch generated by Claude', {
      patchLength: extractedPatch.length,
      tokensUsed: response.usage?.output_tokens || 0
    });

    return extractedPatch;
  }

  /**
   * Build prompt for Claude based on failing tests and ecosystem
   */
  private buildPrompt(failingTests: TestResult[], ecosystem: Ecosystem): string {
    const testDetails = failingTests.map(test => `
Test: ${test.name}
File: ${test.file}
Error: ${test.error}
Output: ${test.output}
`).join('\n');

    const ecosystemContext = this.getEcosystemContext(ecosystem);

    return `You are an expert software engineer tasked with fixing failing tests in a ${ecosystem} project.

The following tests are failing:

${testDetails}

${ecosystemContext}

Please generate a patch that fixes these failing tests. The patch should:
1. Address the root cause of the failures
2. Maintain backward compatibility
3. Follow the project's coding standards
4. Include only the necessary changes
5. Be in unified diff format

Generate only the patch content, no explanations or additional text.`;
  }

  /**
   * Get ecosystem-specific context for the prompt
   */
  private getEcosystemContext(ecosystem: Ecosystem): string {
    switch (ecosystem) {
      case Ecosystem.NODE:
        return `
This is a Node.js project using pnpm. Common fixes include:
- Updating import/require statements for renamed exports
- Fixing async/await usage
- Updating test assertions for new API versions
- Handling breaking changes in dependencies`;
      
      case Ecosystem.RUST:
        return `
This is a Rust project using Cargo. Common fixes include:
- Updating trait implementations for new versions
- Fixing lifetime annotations
- Updating error handling patterns
- Handling breaking changes in dependencies`;
      
      case Ecosystem.PYTHON:
        return `
This is a Python project. Common fixes include:
- Updating import statements
- Fixing type annotations
- Updating test assertions
- Handling breaking changes in dependencies`;
      
      case Ecosystem.GO:
        return `
This is a Go project using modules. Common fixes include:
- Updating import paths
- Fixing interface implementations
- Updating error handling
- Handling breaking changes in dependencies`;
      
      case Ecosystem.DOCKER:
        return `
This is a Docker project. Common fixes include:
- Updating base image references
- Fixing layer caching issues
- Updating build arguments
- Handling breaking changes in base images`;
      
      default:
        return '';
    }
  }

  /**
   * Apply patch using Morph API
   */
  private async applyPatchWithMorph(patch: string, ecosystem: Ecosystem): Promise<boolean> {
    if (!this.morphApiKey) {
      this.logger.warn('Morph API key not configured, skipping patch application');
      return false;
    }

    try {
      this.logger.info('Applying patch with Morph API');

      const response = await axios.post(`${this.morphApiUrl}/apply`, {
        patch,
        ecosystem,
        options: {
          dryRun: false,
          backup: true,
          validate: true
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.morphApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds
      });

      const result = response.data;
      
      if (result.success) {
        this.logger.info('Patch applied successfully via Morph API', {
          filesChanged: result.filesChanged,
          linesAdded: result.linesAdded,
          linesRemoved: result.linesRemoved
        });
        return true;
      } else {
        this.logger.error('Patch application failed via Morph API', {
          error: result.error,
          details: result.details
        });
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to apply patch via Morph API', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Run tests after patch application
   */
  private async runTestsAfterPatch(ecosystem: Ecosystem): Promise<TestResult[]> {
    try {
      this.logger.info('Running tests after patch application');

      const testCommand = this.getTestCommand(ecosystem);
      const { stdout, stderr } = await execAsync(testCommand, { timeout: 300000 }); // 5 minutes

      // Parse test results based on ecosystem
      const testResults = this.parseTestResults(stdout, stderr, ecosystem);
      
      this.logger.info(`Tests completed after patch`, {
        total: testResults.length,
        passed: testResults.filter(t => t.passed).length,
        failed: testResults.filter(t => !t.passed).length
      });

      return testResults;
    } catch (error) {
      this.logger.error('Failed to run tests after patch', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get test command for ecosystem
   */
  private getTestCommand(ecosystem: Ecosystem): string {
    switch (ecosystem) {
      case Ecosystem.NODE:
        return 'pnpm test';
      case Ecosystem.RUST:
        return 'cargo test';
      case Ecosystem.PYTHON:
        return 'python -m pytest';
      case Ecosystem.GO:
        return 'go test ./...';
      case Ecosystem.DOCKER:
        return 'docker build --no-cache .';
      default:
        return 'echo "No test command for ecosystem"';
    }
  }

  /**
   * Parse test results from command output
   */
  private parseTestResults(stdout: string, stderr: string, ecosystem: Ecosystem): TestResult[] {
    const results: TestResult[] = [];
    
    // Simple parsing - in practice, this would be more sophisticated
    const lines = stdout.split('\n');
    let currentTest: Partial<TestResult> = {};

    for (const line of lines) {
      if (line.includes('✓') || line.includes('PASS')) {
        if (currentTest.name) {
          results.push({
            name: currentTest.name,
            file: currentTest.file || '',
            passed: true,
            error: '',
            output: currentTest.output || '',
            duration: currentTest.duration || 0
          });
          currentTest = {};
        }
      } else if (line.includes('✗') || line.includes('FAIL')) {
        if (currentTest.name) {
          results.push({
            name: currentTest.name,
            file: currentTest.file || '',
            passed: false,
            error: currentTest.error || '',
            output: currentTest.output || '',
            duration: currentTest.duration || 0
          });
          currentTest = {};
        }
      } else if (line.includes('test') && line.includes('...')) {
        // Extract test name
        const match = line.match(/(\w+)\s*\.\.\./);
        if (match) {
          currentTest.name = match[1];
        }
      }
    }

    return results;
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options: PatchOptions = {
    testOutputPath: '',
    ecosystem: Ecosystem.NODE,
    dryRun: false,
    maxRetries: 3,
    timeout: 300000, // 5 minutes
    model: 'claude-3-sonnet-20240229',
    temperature: 0.1,
    maxTokens: 4000
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--test-output':
        options.testOutputPath = nextArg;
        i++;
        break;
      case '--ecosystem':
        options.ecosystem = nextArg as Ecosystem;
        i++;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--max-retries':
        options.maxRetries = parseInt(nextArg);
        i++;
        break;
      case '--timeout':
        options.timeout = parseInt(nextArg);
        i++;
        break;
      case '--model':
        options.model = nextArg;
        i++;
        break;
      case '--temperature':
        options.temperature = parseFloat(nextArg);
        i++;
        break;
      case '--max-tokens':
        options.maxTokens = parseInt(nextArg);
        i++;
        break;
      case '--help':
        console.log(`
SpecCursor AI Patch Generator

Usage: node scripts/ai-patch.ts [options]

Options:
  --test-output <path>     Path to test results JSON file
  --ecosystem <ecosystem>  Target ecosystem (node, rust, python, go, docker)
  --dry-run               Run without applying patches
  --max-retries <n>       Maximum retry attempts (default: 3)
  --timeout <ms>          Timeout in milliseconds (default: 300000)
  --model <model>         Claude model to use (default: claude-3-sonnet-20240229)
  --temperature <n>       Temperature for generation (default: 0.1)
  --max-tokens <n>        Maximum tokens for generation (default: 4000)
  --help                  Show this help message

Environment Variables:
  ANTHROPIC_API_KEY       Anthropic API key (required)
  MORPH_API_KEY          Morph API key (optional)
  MORPH_API_URL          Morph API URL (default: https://api.morph.dev)

Examples:
  node scripts/ai-patch.ts --test-output test-results.json --ecosystem node
  node scripts/ai-patch.ts --test-output test-results.json --ecosystem rust --dry-run
        `);
        process.exit(0);
    }
  }

  // Validate required options
  if (!options.testOutputPath) {
    console.error('Error: --test-output is required');
    process.exit(1);
  }

  // Initialize and run
  try {
    const generator = new AIPatchGenerator();
    const result = await generator.generatePatch(options);

    if (result.success) {
      console.log('✅ AI patch generation completed successfully');
      console.log(`📊 Metrics:`, result.metrics);
      
      if (result.patch) {
        console.log(`🔧 Patch generated (${result.patch.length} characters)`);
        if (options.dryRun) {
          console.log('📝 Dry-run mode: patch not applied');
        } else if (result.applied) {
          console.log('✅ Patch applied successfully');
        } else {
          console.log('❌ Patch application failed');
        }
      }
      
      if (result.testResults) {
        const passed = result.testResults.filter(t => t.passed).length;
        const total = result.testResults.length;
        console.log(`🧪 Tests after patch: ${passed}/${total} passed`);
      }
    } else {
      console.error('❌ AI patch generation failed');
      console.error(`Error: ${result.error}`);
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

export { AIPatchGenerator, PatchOptions, PatchResult }; 