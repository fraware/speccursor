# SpecCursor CI Validation Guide

This guide helps you ensure that all CI tests pass before pushing to GitHub. The goal is to have a guaranteed-green CI pipeline.

## Overview

SpecCursor uses a comprehensive CI pipeline with the following stages:

1. **Static Analysis** - ESLint, TypeScript, Prettier, Rust clippy
2. **Unit Tests** - Jest tests with coverage requirements
3. **Property Tests** - Property-based testing for critical invariants
4. **Integration Tests** - End-to-end testing
5. **Security Scans** - Vulnerability scanning
6. **Performance Tests** - Performance benchmarks
7. **Load Tests** - Stress testing
8. **Chaos Tests** - Failure scenario testing
9. **Observability** - Metrics and tracing validation
10. **Cost Budgets** - Resource usage validation
11. **Deployment Drill** - Production deployment simulation

## Matrix Configuration

The CI runs on multiple language versions:

- **Node.js**: 18, 20
- **Rust**: 1.78, nightly
- **Go**: 1.22
- **Python**: 3.12
- **Lean**: 4.20.0

## Local Development Setup

### Prerequisites

1. **Node.js** (18 or 20)
2. **npm** or **pnpm**
3. **Rust** (1.78 or nightly)
4. **Go** (1.22)
5. **Python** (3.12)
6. **Lean** (4.20.0)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/fraware/specursor.git
cd specursor

# Install dependencies
npm install

# Run local CI validation
node scripts/run-ci-tests.js
```

## Running Tests Locally

### Static Analysis

```bash
# Run all static analysis
npm run lint
npm run type-check
npm run format:check

# Run Rust static analysis
cd workers/rust-worker
cargo clippy --all-targets --all-features -- -D warnings
```

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests for specific package
cd apps/github-app
npm run test:unit

# Run Rust tests
cd workers/rust-worker
cargo test
```

### Property Tests

```bash
# Run property-based tests
npm run test:property

# Run specific ecosystem tests
npm run test:property:node
npm run test:property:rust
npm run test:property:go
npm run test:property:python
```

### Security Scans

```bash
# Run security audits
npm run security:audit
npm audit --audit-level=moderate

# Run Rust security audit
cd workers/rust-worker
cargo audit
```

## Coverage Requirements

- **Line Coverage**: ≥ 95%
- **Branch Coverage**: ≥ 95%
- **Function Coverage**: ≥ 90%

## Performance Benchmarks

- **Upgrade Duration**: p95 ≤ 3 seconds
- **Error Rate**: < 0.1%
- **Memory Usage**: ≤ 2GB per worker
- **CPU Usage**: ≤ 70% single-core at p95

## Security Requirements

- **Vulnerability Scan**: No HIGH/CRITICAL vulnerabilities
- **Dependency Audit**: All dependencies up to date
- **CodeQL**: No security issues detected
- **Semgrep**: No security patterns detected

## Common Issues and Fixes

### ESLint Errors

```bash
# Fix auto-fixable issues
npm run lint:fix

# Check specific files
npx eslint apps/github-app/src/index.ts
```

### TypeScript Errors

```bash
# Check types
npm run type-check

# Fix type issues
# Add proper type annotations or fix type definitions
```

### Test Failures

1. **Missing Test Files**: Ensure all packages have test files
2. **Coverage Issues**: Add more test cases
3. **Mock Issues**: Update mocks to match new interfaces
4. **Async Issues**: Use proper async/await patterns

### Rust Issues

```bash
# Fix clippy warnings
cargo clippy --fix

# Update dependencies
cargo update

# Check for security issues
cargo audit
```

### Lean Issues

```bash
# Build Lean project
lake build

# Run Lean tests
lake exe cache get
leanchecker lean/speccursor.lean
```

## Troubleshooting

### Common Failures

1. **Coverage Too Low**
   - Add more test cases
   - Improve test quality
   - Remove dead code

2. **Performance Issues**
   - Optimize hot paths
   - Add caching
   - Reduce memory usage

3. **Security Issues**
   - Update vulnerable dependencies
   - Fix security patterns
   - Address CodeQL findings

4. **Type Errors**
   - Add proper type annotations
   - Fix interface definitions
   - Update type definitions

### Debugging Tips

1. **Run Tests Locally First**

   ```bash
   node scripts/run-ci-tests.js
   ```

2. **Check Specific Stages**

   ```bash
   npm run test:unit
   npm run lint
   npm run type-check
   ```

3. **Use Verbose Output**

   ```bash
   npm run test -- --verbose
   cargo test -- --nocapture
   ```

4. **Check Logs**
   ```bash
   docker-compose logs -f
   ```

## Best Practices

### Before Pushing

1. Run local CI validation
2. Fix all linting issues
3. Ensure all tests pass
4. Check coverage requirements
5. Verify security scans
6. Test performance benchmarks

### Code Quality

1. Follow ESLint rules
2. Use TypeScript strictly
3. Write comprehensive tests
4. Add proper documentation
5. Use conventional commits

### Performance

1. Monitor resource usage
2. Optimize hot paths
3. Use appropriate caching
4. Minimize dependencies
5. Profile regularly

### Security

1. Keep dependencies updated
2. Follow security best practices
3. Use secure defaults
4. Validate all inputs
5. Implement proper authentication

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Testing Framework](https://jestjs.io/)
- [Rust Testing Guide](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Lean 4 Documentation](https://leanprover.github.io/lean4/doc/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Support

If you encounter issues with CI validation:

1. Check the troubleshooting section above
2. Review the GitHub Actions logs
3. Run tests locally to reproduce issues
4. Create an issue with detailed information
5. Ask for help in the team chat
