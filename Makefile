.PHONY: dev dev-up dev-down dev-logs dev-clean install test test-unit test-integration test-coverage build build-clean build-docker lint lint-fix format format-check security-scan security-audit clean deploy-staging deploy-prod docs-build docs-serve release prepare

# Development environment
dev: dev-up
	@echo "Starting SpecCursor development environment..."
	@pnpm run --parallel dev

dev-up:
	@echo "Starting Docker services..."
	@docker-compose up -d
	@echo "Installing dependencies..."
	@pnpm install

dev-down:
	@echo "Stopping development environment..."
	@docker-compose down
	@pnpm run --parallel dev:stop

dev-logs:
	@docker-compose logs -f

dev-clean:
	@echo "Cleaning development environment..."
	@docker-compose down -v
	@pnpm clean

# Dependencies
install:
	@echo "Installing dependencies..."
	@pnpm install

# Testing
test:
	@echo "Running all tests..."
	@pnpm test

test-unit:
	@echo "Running unit tests..."
	@pnpm test:unit

test-integration:
	@echo "Running integration tests..."
	@pnpm test:integration

test-coverage:
	@echo "Running tests with coverage..."
	@pnpm test:coverage

# Building
build:
	@echo "Building all packages..."
	@pnpm build

build-clean:
	@echo "Clean build..."
	@pnpm clean
	@pnpm build

build-docker:
	@echo "Building Docker images..."
	@docker-compose build

# Code quality
lint:
	@echo "Running linters..."
	@pnpm lint

lint-fix:
	@echo "Fixing linting issues..."
	@pnpm lint:fix

format:
	@echo "Formatting code..."
	@pnpm format

format-check:
	@echo "Checking code formatting..."
	@pnpm format:check

# Security
security-scan:
	@echo "Running security scans..."
	@pnpm security:scan

security-audit:
	@echo "Running security audits..."
	@pnpm security:audit

# Utilities
clean:
	@echo "Cleaning build artifacts..."
	@pnpm clean

# Deployment
deploy-staging:
	@echo "Deploying to staging..."
	@pnpm deploy:staging

deploy-prod:
	@echo "Deploying to production..."
	@pnpm deploy:prod

# Documentation
docs-build:
	@echo "Building documentation..."
	@pnpm docs:build

docs-serve:
	@echo "Serving documentation..."
	@pnpm docs:serve

# Release
release:
	@echo "Creating release..."
	@pnpm release

# Setup
prepare:
	@echo "Preparing development environment..."
	@pnpm prepare

# CI-specific targets
ci-setup:
	@echo "Setting up CI environment..."
	@pnpm install --frozen-lockfile
	@if [ -f "Cargo.toml" ]; then cargo fetch; fi
	@if [ -f "requirements.txt" ]; then pip install -r requirements.txt; fi
	@if [ -f "go.mod" ]; then go mod download; fi

ci-test:
	@echo "Running CI tests..."
	@pnpm test:unit
	@pnpm test:coverage

ci-lint:
	@echo "Running CI linting..."
	@pnpm lint
	@pnpm format:check
	@pnpm type-check

ci-build:
	@echo "Running CI build..."
	@pnpm build

ci-security:
	@echo "Running CI security checks..."
	@pnpm security:audit
	@if [ -f "Cargo.toml" ]; then cargo audit; fi
	@if [ -f "requirements.txt" ]; then safety check; fi

# Help
help:
	@echo "Available commands:"
	@echo "  dev          - Start development environment"
	@echo "  dev-up       - Start Docker services and install deps"
	@echo "  dev-down     - Stop development environment"
	@echo "  dev-logs     - Show Docker logs"
	@echo "  dev-clean    - Clean development environment"
	@echo "  install      - Install dependencies"
	@echo "  test         - Run all tests"
	@echo "  test-unit    - Run unit tests"
	@echo "  test-integration - Run integration tests"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  build        - Build all packages"
	@echo "  build-clean  - Clean build"
	@echo "  build-docker - Build Docker images"
	@echo "  lint         - Run linters"
	@echo "  lint-fix     - Fix linting issues"
	@echo "  format       - Format code"
	@echo "  format-check - Check code formatting"
	@echo "  security-scan - Run security scans"
	@echo "  security-audit - Run security audits"
	@echo "  clean        - Clean build artifacts"
	@echo "  deploy-staging - Deploy to staging"
	@echo "  deploy-prod  - Deploy to production"
	@echo "  docs-build   - Build documentation"
	@echo "  docs-serve   - Serve documentation"
	@echo "  release      - Create release"
	@echo "  prepare      - Prepare development environment"
	@echo "  help         - Show this help" 