# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project scaffolding and development environment setup
- Comprehensive monorepo structure with pnpm workspaces
- Docker Compose configuration for local development
- PostgreSQL database schema with tables for upgrades, proofs, AI patches, and jobs
- Prometheus, Grafana, Loki, and Jaeger for observability
- ESLint, Prettier, and TypeScript configuration
- Git hooks for pre-commit and commit-msg validation
- Conventional commit format enforcement
- Comprehensive contributing guidelines
- MIT License

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [0.1.0] - 2024-01-XX

### Added
- Initial release with architecture and threat model documentation
- High-level C4 model diagrams (Context, Container, Component, Deployment)
- Comprehensive STRIDE-based threat analysis
- API specification for all services
- Security-first design principles
- Multi-ecosystem support planning (Node.js, Rust, Python, Go, Dockerfile)
- Lean 4.20.0 integration planning
- Claude Sonnet 4 AI integration planning
- AWS infrastructure planning with Terraform
- Observability stack planning (Prometheus, OpenTelemetry, Grafana)

---

## Version History

- **0.1.0**: Initial architecture and documentation release
- **Unreleased**: Development environment and scaffolding

## Release Notes

### Version 0.1.0
This is the initial release of SpecCursor, focusing on establishing the foundational architecture and security model. The release includes:

- **Architecture Documentation**: Comprehensive C4 model diagrams and system design
- **Security Framework**: STRIDE-based threat model with detailed mitigation strategies
- **API Design**: Complete API specification for all services
- **Technology Stack**: Defined technology choices and integration points
- **Development Guidelines**: Coding standards and contribution guidelines

### Upcoming Releases

#### Version 1.0.0 (Planned)
- Core GitHub App implementation
- Basic dependency upgrade functionality
- Node.js ecosystem support
- Initial AI integration with Claude
- Basic Lean proof engine

#### Version 1.1.0 (Planned)
- Rust ecosystem support
- Enhanced AI patching capabilities
- Improved proof verification

#### Version 1.2.0 (Planned)
- Python ecosystem support
- Advanced regression detection
- Enhanced security features

#### Version 1.3.0 (Planned)
- Go ecosystem support
- Multi-repository analysis
- Performance optimizations

#### Version 2.0.0 (Planned)
- Advanced Lean integration
- Custom theorem proving
- Machine learning for patch quality prediction

---

## Contributing

To add entries to this changelog:

1. Follow the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format
2. Use the appropriate section headers
3. Include the date for each version
4. Add entries under the [Unreleased] section for upcoming changes
5. Move [Unreleased] entries to a new version section when releasing

## Links

- [GitHub Repository](https://github.com/speccursor/speccursor)
- [Documentation](https://speccursor.dev)
- [Issues](https://github.com/speccursor/speccursor/issues)
- [Discussions](https://github.com/speccursor/speccursor/discussions) 