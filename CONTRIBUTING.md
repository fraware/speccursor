# Contributing to SpecCursor

Thank you for your interest in contributing to SpecCursor! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Security](#security)
- [Documentation](#documentation)
- [Release Process](#release-process)
- [Support](#support)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 18+ with pnpm
- Rust 1.70+
- Go 1.21+
- Python 3.11+
- Docker & Docker Compose
- Lean 4.20.0

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/speccursor.git
   cd speccursor
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Start Development Environment**
   ```bash
   pnpm dev:up
   ```

4. **Run Tests**
   ```bash
   pnpm test
   ```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

Follow the coding standards and ensure all tests pass.

### 3. Run Quality Checks

```bash
# Lint and format code
pnpm lint
pnpm format

# Run tests
pnpm test

# Security audit
pnpm security:audit
```

### 4. Commit Your Changes

Use conventional commits:

```bash
git commit -m "feat(github-app): add webhook signature verification"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

## Coding Standards

### TypeScript/JavaScript

- **Strict Mode**: Always use TypeScript strict mode
- **ESLint**: Follow the project's ESLint configuration
- **Prettier**: Use Prettier for code formatting
- **Imports**: Use absolute imports with path mapping
- **Types**: Prefer explicit types over `any`
- **Error Handling**: Use proper error handling with custom error types

```typescript
// Good
import { UpgradeService } from '@speccursor/shared-utils';
import type { UpgradeRequest } from '@speccursor/shared-types';

export class GitHubAppService {
  private readonly upgradeService: UpgradeService;

  constructor(upgradeService: UpgradeService) {
    this.upgradeService = upgradeService;
  }

  async handleWebhook(payload: WebhookPayload): Promise<void> {
    try {
      await this.upgradeService.processUpgrade(payload);
    } catch (error) {
      this.logger.error('Failed to process webhook', { error });
      throw new WebhookProcessingError('Webhook processing failed', { cause: error });
    }
  }
}
```

### Rust

- **rustfmt**: Use `cargo fmt` for formatting
- **clippy**: Run `cargo clippy` for linting
- **Error Handling**: Use `Result<T, E>` and `?` operator
- **Documentation**: Document all public APIs
- **Tests**: Write unit and integration tests

```rust
use anyhow::Result;
use tracing::{info, error};

#[derive(Debug, thiserror::Error)]
pub enum WorkerError {
    #[error("Failed to process job: {0}")]
    JobProcessingFailed(String),
}

pub struct WorkerPool {
    config: WorkerConfig,
    logger: Logger,
}

impl WorkerPool {
    pub async fn process_job(&self, job: Job) -> Result<JobResult> {
        info!("Processing job: {:?}", job.id);
        
        match self.execute_job(job).await {
            Ok(result) => {
                info!("Job completed successfully: {:?}", job.id);
                Ok(result)
            }
            Err(e) => {
                error!("Job failed: {:?}, error: {}", job.id, e);
                Err(WorkerError::JobProcessingFailed(e.to_string()).into())
            }
        }
    }
}
```

### Go

- **gofmt**: Use `gofmt` for formatting
- **golangci-lint**: Follow the project's linting rules
- **Error Handling**: Use proper error wrapping
- **Documentation**: Document all exported functions
- **Tests**: Write comprehensive tests

```go
package worker

import (
    "context"
    "fmt"
    "time"
    
    "github.com/speccursor/speccursor/internal/types"
)

// WorkerPool manages a pool of workers for processing jobs
type WorkerPool struct {
    config *Config
    logger *Logger
}

// ProcessJob processes a single job with timeout
func (wp *WorkerPool) ProcessJob(ctx context.Context, job *types.Job) (*types.JobResult, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
    defer cancel()
    
    wp.logger.Info("Processing job", "job_id", job.ID)
    
    result, err := wp.executeJob(ctx, job)
    if err != nil {
        wp.logger.Error("Job processing failed", "job_id", job.ID, "error", err)
        return nil, fmt.Errorf("failed to process job: %w", err)
    }
    
    wp.logger.Info("Job completed successfully", "job_id", job.ID)
    return result, nil
}
```

### Python

- **black**: Use Black for code formatting
- **flake8**: Follow flake8 linting rules
- **mypy**: Use type hints and mypy for type checking
- **Documentation**: Use docstrings for all functions
- **Tests**: Write pytest tests

```python
from typing import Optional, Dict, Any
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class JobResult:
    """Result of a job execution."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class WorkerPool:
    """Manages a pool of workers for processing jobs."""
    
    def __init__(self, config: Dict[str, Any]) -> None:
        """Initialize the worker pool with configuration."""
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    def process_job(self, job: Dict[str, Any]) -> JobResult:
        """Process a single job with error handling."""
        try:
            self.logger.info(f"Processing job: {job.get('id')}")
            result = self._execute_job(job)
            self.logger.info(f"Job completed successfully: {job.get('id')}")
            return JobResult(success=True, data=result)
        except Exception as e:
            self.logger.error(f"Job failed: {job.get('id')}, error: {e}")
            return JobResult(success=False, error=str(e))
```

### Lean

- **lake build**: Use Lake for building
- **Documentation**: Use Lean doc comments
- **Theorems**: Write clear, well-documented theorems
- **Tests**: Use Lean's testing framework

```lean
import Mathlib.Data.Nat.Basic
import Mathlib.Algebra.Ring.Basic

/-- SpecCursor Lean Engine for formal verification -/

namespace SpecCursor

/-- Configuration for the Lean engine -/
structure LeanConfig where
  timeout : Nat := 300
  memoryLimit : Nat := 2048
  deriving Repr

/-- Result of a proof verification -/
inductive ProofResult
  | verified (proof : String)
  | failed (error : String)
  | timeout
  deriving Repr

/-- Verify a proof using Lean -/
def verifyProof (config : LeanConfig) (code : String) : IO ProofResult := do
  -- Implementation here
  pure (ProofResult.verified "proof verified")

end SpecCursor
```

## Testing

### Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data and fixtures
```

### Test Guidelines

- **Coverage**: Aim for >95% test coverage
- **Naming**: Use descriptive test names
- **Isolation**: Tests should be independent
- **Mocking**: Use mocks for external dependencies
- **Fixtures**: Use fixtures for test data

### Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# Coverage report
pnpm test:coverage
```

## Security

### Security Guidelines

- **Input Validation**: Always validate and sanitize inputs
- **Authentication**: Use proper authentication mechanisms
- **Authorization**: Implement proper authorization checks
- **Secrets**: Never commit secrets to version control
- **Dependencies**: Regularly update dependencies
- **Vulnerabilities**: Report security vulnerabilities privately

### Security Checks

```bash
# Run security scans
pnpm security:scan

# Audit dependencies
pnpm security:audit
```

## Documentation

### Documentation Standards

- **README**: Keep README up to date
- **API Docs**: Document all public APIs
- **Architecture**: Maintain architecture documentation
- **Examples**: Provide usage examples
- **Changelog**: Keep CHANGELOG.md updated

### Documentation Structure

```
docs/
├── architecture/   # Architecture documentation
├── api/           # API documentation
├── guides/        # User guides
└── examples/      # Code examples
```

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Create Release Branch**
   ```bash
   git checkout -b release/v1.0.0
   ```

2. **Update Version**
   ```bash
   pnpm version patch  # or minor/major
   ```

3. **Update Changelog**
   - Add release notes to CHANGELOG.md
   - Include all significant changes

4. **Create Pull Request**
   - Submit PR for review
   - Ensure all tests pass
   - Get approval from maintainers

5. **Merge and Tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Support

### Getting Help

- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the docs first
- **Community**: Join our community channels

### Reporting Issues

When reporting issues, please include:

- **Environment**: OS, Node.js version, etc.
- **Steps**: Clear steps to reproduce
- **Expected**: What you expected to happen
- **Actual**: What actually happened
- **Logs**: Relevant error logs

### Feature Requests

For feature requests:

- **Use Case**: Describe the use case
- **Benefits**: Explain the benefits
- **Implementation**: Suggest implementation approach
- **Priority**: Indicate priority level

## Recognition

Contributors will be recognized in:

- **README**: List of contributors
- **Releases**: Release notes
- **Documentation**: Contributor acknowledgments

Thank you for contributing to SpecCursor! 🚀 