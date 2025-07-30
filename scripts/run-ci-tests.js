#!/usr/bin/env node

/**
 * SpecCursor CI Test Runner
 * 
 * This script runs the same tests as the GitHub Actions CI pipeline
 * to help diagnose and fix issues locally before pushing.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n${colors.cyan}=== ${step} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test configuration
const testConfig = {
  nodeVersions: [18, 20],
  rustVersions: ['1.78', 'nightly'],
  goVersions: ['1.22'],
  pythonVersions: ['3.12'],
  leanVersions: ['4.20.0']
};

// Test stages
const stages = [
  {
    name: 'Static Analysis',
    command: 'npm run lint && npm run type-check && npm run format:check',
    description: 'Running ESLint, TypeScript checks, and Prettier validation'
  },
  {
    name: 'Unit Tests',
    command: 'npm run test:unit',
    description: 'Running unit tests with coverage'
  },
  {
    name: 'Property Tests',
    command: 'npm run test:property',
    description: 'Running property-based tests'
  },
  {
    name: 'Integration Tests',
    command: 'npm run test:integration',
    description: 'Running integration tests'
  },
  {
    name: 'Security Scans',
    command: 'npm run security:scan',
    description: 'Running security vulnerability scans'
  },
  {
    name: 'Performance Tests',
    command: 'npm run test:performance',
    description: 'Running performance benchmarks'
  }
];

function runCommand(command, cwd = process.cwd()) {
  try {
    logInfo(`Running: ${command}`);
    const result = execSync(command, {
      cwd,
      stdio: 'inherit',
      encoding: 'utf8'
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

function checkDependencies() {
  logStep('Checking Dependencies');
  
  // Check if Node.js is available
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    logSuccess(`Node.js version: ${nodeVersion}`);
  } catch (error) {
    logError('Node.js is not installed or not in PATH');
    return false;
  }

  // Check if npm is available
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    logSuccess(`npm version: ${npmVersion}`);
  } catch (error) {
    logError('npm is not installed or not in PATH');
    return false;
  }

  // Check if Rust is available
  try {
    const rustVersion = execSync('rustc --version', { encoding: 'utf8' }).trim();
    logSuccess(`Rust version: ${rustVersion}`);
  } catch (error) {
    logWarning('Rust is not installed or not in PATH');
  }

  // Check if Go is available
  try {
    const goVersion = execSync('go version', { encoding: 'utf8' }).trim();
    logSuccess(`Go version: ${goVersion}`);
  } catch (error) {
    logWarning('Go is not installed or not in PATH');
  }

  // Check if Python is available
  try {
    const pythonVersion = execSync('python --version', { encoding: 'utf8' }).trim();
    logSuccess(`Python version: ${pythonVersion}`);
  } catch (error) {
    logWarning('Python is not installed or not in PATH');
  }

  return true;
}

function installDependencies() {
  logStep('Installing Dependencies');
  
  // Install npm dependencies
  const npmResult = runCommand('npm install');
  if (!npmResult.success) {
    logError('Failed to install npm dependencies');
    return false;
  }
  logSuccess('npm dependencies installed');

  // Install Rust dependencies if Cargo.toml exists
  if (fs.existsSync('workers/rust-worker/Cargo.toml')) {
    const cargoResult = runCommand('cargo fetch', 'workers/rust-worker');
    if (cargoResult.success) {
      logSuccess('Rust dependencies fetched');
    } else {
      logWarning('Failed to fetch Rust dependencies');
    }
  }

  return true;
}

function runStaticAnalysis() {
  logStep('Stage 1: Static Analysis');
  
  let allPassed = true;

  // ESLint
  logInfo('Running ESLint...');
  const eslintResult = runCommand('npm run lint');
  if (eslintResult.success) {
    logSuccess('ESLint passed');
  } else {
    logError('ESLint failed');
    allPassed = false;
  }

  // TypeScript type check
  logInfo('Running TypeScript type check...');
  const tscResult = runCommand('npm run type-check');
  if (tscResult.success) {
    logSuccess('TypeScript type check passed');
  } else {
    logError('TypeScript type check failed');
    allPassed = false;
  }

  // Prettier check
  logInfo('Running Prettier check...');
  const prettierResult = runCommand('npm run format:check');
  if (prettierResult.success) {
    logSuccess('Prettier check passed');
  } else {
    logError('Prettier check failed');
    allPassed = false;
  }

  // Rust clippy if available
  if (fs.existsSync('workers/rust-worker/Cargo.toml')) {
    logInfo('Running Rust clippy...');
    const clippyResult = runCommand('cargo clippy --all-targets --all-features -- -D warnings', 'workers/rust-worker');
    if (clippyResult.success) {
      logSuccess('Rust clippy passed');
    } else {
      logWarning('Rust clippy failed');
    }
  }

  return allPassed;
}

function runUnitTests() {
  logStep('Stage 2: Unit Tests');
  
  let allPassed = true;

  // Run tests for each package
  const packages = [
    'apps/github-app',
    'apps/ai-service', 
    'apps/controller',
    'packages/shared-types',
    'packages/shared-utils',
    'packages/shared-config'
  ];

  for (const pkg of packages) {
    if (fs.existsSync(path.join(pkg, 'package.json'))) {
      logInfo(`Running tests for ${pkg}...`);
      const testResult = runCommand('npm run test:unit', pkg);
      if (testResult.success) {
        logSuccess(`${pkg} tests passed`);
      } else {
        logError(`${pkg} tests failed`);
        allPassed = false;
      }
    }
  }

  // Run Rust tests if available
  if (fs.existsSync('workers/rust-worker/Cargo.toml')) {
    logInfo('Running Rust tests...');
    const rustTestResult = runCommand('cargo test', 'workers/rust-worker');
    if (rustTestResult.success) {
      logSuccess('Rust tests passed');
    } else {
      logError('Rust tests failed');
      allPassed = false;
    }
  }

  return allPassed;
}

function runPropertyTests() {
  logStep('Stage 3: Property Tests');
  
  let allPassed = true;

  // Run property tests
  const propertyTestResult = runCommand('npm run test:property');
  if (propertyTestResult.success) {
    logSuccess('Property tests passed');
  } else {
    logError('Property tests failed');
    allPassed = false;
  }

  return allPassed;
}

function runSecurityScans() {
  logStep('Stage 4: Security Scans');
  
  let allPassed = true;

  // Run security audit
  logInfo('Running npm audit...');
  const auditResult = runCommand('npm audit --audit-level=moderate');
  if (auditResult.success) {
    logSuccess('npm audit passed');
  } else {
    logWarning('npm audit found vulnerabilities');
  }

  // Run Rust security audit if available
  if (fs.existsSync('workers/rust-worker/Cargo.toml')) {
    logInfo('Running cargo audit...');
    const cargoAuditResult = runCommand('cargo audit', 'workers/rust-worker');
    if (cargoAuditResult.success) {
      logSuccess('cargo audit passed');
    } else {
      logWarning('cargo audit found vulnerabilities');
    }
  }

  return allPassed;
}

function generateReport(results) {
  logStep('Test Results Summary');
  
  const totalStages = Object.keys(results).length;
  const passedStages = Object.values(results).filter(Boolean).length;
  const failedStages = totalStages - passedStages;

  logInfo(`Total stages: ${totalStages}`);
  logInfo(`Passed: ${passedStages}`);
  logInfo(`Failed: ${failedStages}`);

  if (failedStages === 0) {
    logSuccess('🎉 All CI stages passed! Ready for deployment.');
    return true;
  } else {
    logError(`❌ ${failedStages} stage(s) failed. Please fix the issues above.`);
    return false;
  }
}

function main() {
  log(`${colors.bright}🚀 SpecCursor CI Test Runner${colors.reset}`, 'cyan');
  log('Running local CI validation...', 'blue');

  const results = {};

  // Check dependencies
  if (!checkDependencies()) {
    process.exit(1);
  }

  // Install dependencies
  if (!installDependencies()) {
    process.exit(1);
  }

  // Run static analysis
  results.staticAnalysis = runStaticAnalysis();

  // Run unit tests
  results.unitTests = runUnitTests();

  // Run property tests
  results.propertyTests = runPropertyTests();

  // Run security scans
  results.securityScans = runSecurityScans();

  // Generate final report
  const allPassed = generateReport(results);

  if (allPassed) {
    log('\n🎯 Ready to push! All CI checks should pass on GitHub.', 'green');
    process.exit(0);
  } else {
    log('\n🔧 Please fix the failing tests before pushing to GitHub.', 'red');
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runStaticAnalysis,
  runUnitTests,
  runPropertyTests,
  runSecurityScans,
  checkDependencies,
  installDependencies
}; 