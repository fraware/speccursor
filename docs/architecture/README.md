# SpecCursor Architecture & Threat Model

## Overview

SpecCursor is a GitHub App that autonomously upgrades dependencies, patches regressions using AI, and proves invariants using Lean 4.20.0. This document outlines the high-level architecture, threat model, and security considerations.

## High-Level Architecture

### Core Components

1. **GitHub App** - Webhook receiver and PR management
2. **Controller Service** - Orchestrates upgrade workflows
3. **Worker Pool** - Executes ecosystem-specific upgrades
4. **AI Patch Service** - Claude-powered regression fixes
5. **Lean Proof Engine** - Formal verification of invariants
6. **State Management** - PostgreSQL for persistence, Redis for caching

### Technology Stack

- **Backend**: Node.js (TypeScript), Rust (performance-critical components)
- **AI**: Anthropic Claude Sonnet 4 via API
- **Formal Verification**: Lean 4.20.0 with Mathlib4
- **Infrastructure**: Docker, Terraform, AWS
- **Observability**: Prometheus, OpenTelemetry, Grafana

## C4 Model

### Level 1: System Context

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub.com    │    │   Anthropic     │    │   Lean 4.20.0   │
│                 │    │   Claude API    │    │   Mathlib4      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SpecCursor System                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ GitHub App  │  │ Controller  │  │ Worker Pool │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ AI Service  │  │ Lean Engine │  │ State Store │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Level 2: Container Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SpecCursor Platform                        │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ GitHub App  │◄──►│ Controller  │◄──►│ Worker Pool │     │
│  │ (Node.js)   │    │ (Node.js)   │    │ (Rust)      │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                   │                   │            │
│         ▼                   ▼                   ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ AI Service  │    │ Lean Engine │    │ State Store │     │
│  │ (Node.js)   │    │ (Lean 4.20)│    │ (PostgreSQL)│     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Cache Store │    │ Metrics     │    │ Logs        │     │
│  │ (Redis)     │    │ (Prometheus)│    │ (Loki)      │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## API Boundaries

### GitHub App API

- **Webhook Endpoints**: `/webhook/release`, `/webhook/push`
- **Authentication**: GitHub App JWT tokens
- **Rate Limits**: Respect GitHub API limits
- **Security**: OIDC for token exchange

### Controller Service API

- **Internal**: gRPC for service-to-service communication
- **External**: REST API for admin operations
- **Authentication**: JWT with role-based access
- **Rate Limits**: Per-client token buckets

### Worker Pool API

- **Job Queue**: Redis-based priority queue
- **Status Updates**: WebSocket for real-time progress
- **Resource Limits**: CPU/memory quotas per job
- **Timeout**: 30-minute maximum per upgrade

## Data Flows

### 1. Release Detection Flow

```
GitHub Release → Webhook → Controller → Worker → Upgrade → PR
```

### 2. AI Patch Flow

```
Test Failure → AI Service → Claude API → Morph Apply → Re-test
```

### 3. Proof Verification Flow

```
Code Change → Lean Engine → Mathlib4 → Proof Status → PR Comment
```

## Security Architecture

### Threat Model (STRIDE)

#### Spoofing

- **Threat**: Malicious actor impersonates GitHub webhook
- **Mitigation**: Webhook signature verification, HMAC validation
- **Controls**: GitHub webhook secret, request signing

#### Tampering

- **Threat**: Code injection during AI patch application
- **Mitigation**: Sandboxed execution, input validation
- **Controls**: Firecracker/gVisor containers, code signing

#### Repudiation

- **Threat**: Denial of upgrade actions
- **Mitigation**: Comprehensive audit logging
- **Controls**: Structured logging, immutable audit trail

#### Information Disclosure

- **Threat**: Exposure of API keys or sensitive data
- **Mitigation**: Secret management, encryption at rest
- **Controls**: AWS Secrets Manager, TLS 1.3, encryption

#### Denial of Service

- **Threat**: Resource exhaustion attacks
- **Mitigation**: Rate limiting, resource quotas
- **Controls**: Circuit breakers, autoscaling, timeouts

#### Elevation of Privilege

- **Threat**: Unauthorized access to production systems
- **Mitigation**: Principle of least privilege
- **Controls**: RBAC, network segmentation, pod security policies

### Security Controls

#### Network Security

- **VPC**: Isolated network segments
- **WAF**: AWS WAF for webhook endpoints
- **TLS**: End-to-end encryption for all communications
- **VPN**: Secure admin access

#### Application Security

- **Input Validation**: Strict schema validation
- **Output Encoding**: Prevent XSS in PR comments
- **Authentication**: Multi-factor for admin access
- **Authorization**: Role-based access control

#### Infrastructure Security

- **Container Security**: Non-root containers, read-only filesystems
- **Secret Management**: AWS Secrets Manager integration
- **Monitoring**: Security event correlation
- **Compliance**: SOC 2, GDPR considerations

## Failure Modes & Recovery

### Network Failures

- **Detection**: Health checks, circuit breakers
- **Recovery**: Retry with exponential backoff
- **Fallback**: Queue jobs for later processing

### Model Hallucination

- **Detection**: Test suite validation, diff size limits
- **Recovery**: Manual intervention, rollback
- **Prevention**: Temperature 0, strict tool instructions

### Proof Divergence

- **Detection**: Lean proof checker, timeout monitoring
- **Recovery**: Manual proof review, theorem restatement
- **Prevention**: Incremental proof development

### Resource Exhaustion

- **Detection**: Resource monitoring, alerting
- **Recovery**: Autoscaling, job prioritization
- **Prevention**: Resource quotas, admission control

## Performance Considerations

### Scalability

- **Horizontal**: Worker pool autoscaling
- **Vertical**: Resource optimization per job
- **Caching**: Redis for frequently accessed data
- **CDN**: Static asset delivery

### Latency

- **Target**: <5s webhook response, <30min upgrade completion
- **Optimization**: Async processing, parallel execution
- **Monitoring**: P95, P99 latency tracking

### Throughput

- **Target**: 1000 upgrades/day across all ecosystems
- **Bottlenecks**: AI API rate limits, Lean proof complexity
- **Optimization**: Batch processing, proof caching

## Monitoring & Observability

### Metrics

- `upgrade_duration_seconds` - Time to complete upgrades
- `proof_latency_seconds` - Lean proof verification time
- `ai_tokens_total` - Claude API token consumption
- `upgrade_success_rate` - Success/failure ratio

### Logging

- **Structured**: JSON format with correlation IDs
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Retention**: 90 days for compliance

### Tracing

- **Distributed**: OpenTelemetry for request tracing
- **Sampling**: 100% for errors, 10% for success
- **Visualization**: Grafana dashboards

## Compliance & Governance

### Data Privacy

- **GDPR**: Right to deletion, data portability
- **CCPA**: California privacy compliance
- **Retention**: Configurable data retention policies

### Audit Requirements

- **SOC 2**: Security controls documentation
- **PCI DSS**: If handling payment data
- **FedRAMP**: For government deployments

## Next Steps

1. **Repository Scaffolding** - Set up monorepo structure
2. **Domain Model** - Implement Lean 4.20.0 specifications
3. **GitHub App** - Create webhook handlers and composite actions
4. **AI Integration** - Implement Claude API integration
5. **Infrastructure** - Deploy with Terraform

## References

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Lean 4.20.0 Documentation](https://leanprover.github.io/lean4/doc/)
- [STRIDE Threat Modeling](https://owasp.org/www-community/Threat_Modeling)
- [C4 Model](https://c4model.com/)
