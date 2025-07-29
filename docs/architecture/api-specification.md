# SpecCursor API Specification

## Overview

This document defines the complete API specification for SpecCursor, including internal service-to-service communication, external APIs, and security requirements.

## API Design Principles

1. **Security First**: All APIs require authentication and authorization
2. **Rate Limiting**: Prevent abuse and ensure fair usage
3. **Versioning**: Backward-compatible API versioning
4. **Documentation**: OpenAPI/Swagger specifications
5. **Monitoring**: Comprehensive metrics and logging

## Authentication & Authorization

### JWT Token Authentication

```typescript
interface JWTPayload {
  sub: string; // Subject (user/service ID)
  iss: string; // Issuer (SpecCursor)
  aud: string; // Audience (service name)
  exp: number; // Expiration time
  iat: number; // Issued at
  scope: string[]; // Permissions
  jti: string; // JWT ID (unique identifier)
}
```

### OAuth 2.0 / OIDC Integration

```yaml
# OAuth 2.0 Configuration
oauth2:
  authorization_endpoint: "https://auth.speccursor.com/oauth/authorize"
  token_endpoint: "https://auth.speccursor.com/oauth/token"
  userinfo_endpoint: "https://auth.speccursor.com/oauth/userinfo"
  jwks_uri: "https://auth.speccursor.com/.well-known/jwks.json"

scopes:
  - "read:upgrades"
  - "write:upgrades"
  - "read:proofs"
  - "write:proofs"
  - "admin:system"
```

## External APIs

### 1. GitHub App API

#### Webhook Endpoints

```typescript
// POST /webhook/release
interface ReleaseWebhook {
  action:
    | "published"
    | "created"
    | "edited"
    | "deleted"
    | "prereleased"
    | "released";
  release: {
    id: number;
    tag_name: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    published_at: string;
    author: {
      login: string;
      id: number;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    owner: {
      login: string;
      id: number;
    };
  };
  sender: {
    login: string;
    id: number;
  };
}

// POST /webhook/push
interface PushWebhook {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}
```

#### Authentication

- **Method**: HMAC-SHA256 signature verification
- **Header**: `X-Hub-Signature-256`
- **Secret**: Rotated every 90 days
- **Rate Limit**: GitHub webhook limits (1000/hour)

#### Response Format

```typescript
interface WebhookResponse {
  success: boolean;
  message: string;
  job_id?: string;
  errors?: string[];
}
```

### 2. Admin API

#### Authentication

- **Method**: JWT Bearer token
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `admin:system`

#### Endpoints

```typescript
// GET /api/v1/admin/upgrades
interface GetUpgradesRequest {
  page?: number;
  limit?: number;
  status?: "pending" | "running" | "completed" | "failed";
  ecosystem?: "node" | "rust" | "python" | "go" | "dockerfile";
  repository?: string;
}

interface GetUpgradesResponse {
  upgrades: Array<{
    id: string;
    repository: string;
    ecosystem: string;
    status: string;
    created_at: string;
    completed_at?: string;
    error?: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// POST /api/v1/admin/upgrades/{id}/retry
interface RetryUpgradeRequest {
  force?: boolean;
}

// GET /api/v1/admin/metrics
interface MetricsResponse {
  upgrades: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  proofs: {
    total: number;
    successful: number;
    failed: number;
    average_duration: number;
  };
  ai: {
    total_requests: number;
    total_tokens: number;
    average_latency: number;
  };
}

// GET /api/v1/admin/health
interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  services: {
    [service: string]: {
      status: "healthy" | "degraded" | "unhealthy";
      latency?: number;
      error?: string;
    };
  };
  timestamp: string;
}
```

## Internal APIs

### 1. Controller Service API (gRPC)

#### Protocol Buffer Definition

```protobuf
syntax = "proto3";

package speccursor.controller.v1;

import "google/protobuf/timestamp.proto";

service ControllerService {
  // Upgrade management
  rpc CreateUpgrade(CreateUpgradeRequest) returns (CreateUpgradeResponse);
  rpc GetUpgrade(GetUpgradeRequest) returns (GetUpgradeResponse);
  rpc ListUpgrades(ListUpgradesRequest) returns (ListUpgradesResponse);
  rpc UpdateUpgradeStatus(UpdateUpgradeStatusRequest) returns (UpdateUpgradeStatusResponse);

  // Proof management
  rpc CreateProof(CreateProofRequest) returns (CreateProofResponse);
  rpc GetProof(GetProofRequest) returns (GetProofResponse);
  rpc ListProofs(ListProofsRequest) returns (ListProofsResponse);

  // AI patch management
  rpc CreateAIPatch(CreateAIPatchRequest) returns (CreateAIPatchResponse);
  rpc GetAIPatch(GetAIPatchRequest) returns (GetAIPatchResponse);

  // System management
  rpc GetHealth(GetHealthRequest) returns (GetHealthResponse);
  rpc GetMetrics(GetMetricsRequest) returns (GetMetricsResponse);
}

message CreateUpgradeRequest {
  string repository = 1;
  string ecosystem = 2;
  string package_name = 3;
  string current_version = 4;
  string target_version = 5;
  map<string, string> metadata = 6;
}

message CreateUpgradeResponse {
  string upgrade_id = 1;
  string status = 2;
  google.protobuf.Timestamp created_at = 3;
}

message GetUpgradeRequest {
  string upgrade_id = 1;
}

message GetUpgradeResponse {
  Upgrade upgrade = 1;
}

message Upgrade {
  string id = 1;
  string repository = 2;
  string ecosystem = 3;
  string package_name = 4;
  string current_version = 5;
  string target_version = 6;
  string status = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
  google.protobuf.Timestamp completed_at = 10;
  string error = 11;
  map<string, string> metadata = 12;
}

message CreateProofRequest {
  string upgrade_id = 1;
  string theorem_name = 2;
  string lean_code = 3;
}

message CreateProofResponse {
  string proof_id = 1;
  string status = 2;
  google.protobuf.Timestamp created_at = 3;
}

message CreateAIPatchRequest {
  string upgrade_id = 1;
  string failing_test = 2;
  string error_message = 3;
  string current_code = 4;
}

message CreateAIPatchResponse {
  string patch_id = 1;
  string status = 2;
  string generated_patch = 3;
  google.protobuf.Timestamp created_at = 4;
}
```

#### Authentication

- **Method**: mTLS with service certificates
- **Certificate Authority**: Internal CA for service-to-service communication
- **Certificate Rotation**: Every 30 days

### 2. Worker Pool API

#### Job Queue Interface

```typescript
interface Job {
  id: string;
  type: "upgrade" | "proof" | "ai_patch";
  priority: number;
  payload: any;
  created_at: Date;
  timeout: number;
  retries: number;
  max_retries: number;
}

interface JobResult {
  job_id: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  metadata: Record<string, any>;
}
```

#### Redis Queue Structure

```redis
# Job queues
speccursor:jobs:upgrade:high
speccursor:jobs:upgrade:normal
speccursor:jobs:upgrade:low
speccursor:jobs:proof
speccursor:jobs:ai_patch

# Job results
speccursor:results:{job_id}

# Job status
speccursor:status:{job_id}
```

### 3. AI Service API

#### Claude API Integration

```typescript
interface ClaudeRequest {
  model: "claude-3-sonnet-20240229";
  max_tokens: number;
  temperature: number;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: object;
    };
  }>;
}

interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{
    type: "text";
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

#### Rate Limiting

- **Requests**: 1000/minute per API key
- **Tokens**: 1,000,000/minute per API key
- **Concurrent**: 10 requests per API key

### 4. Lean Engine API

#### Local IPC Interface

```typescript
interface LeanRequest {
  command: "check" | "prove" | "build";
  file_path: string;
  theorem_name?: string;
  timeout: number;
}

interface LeanResponse {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  proof_status?: "success" | "failed" | "timeout";
}
```

## Rate Limiting

### Global Rate Limits

```yaml
rate_limits:
  webhook:
    requests_per_minute: 1000
    burst_size: 100

  admin_api:
    requests_per_minute: 100
    burst_size: 10

  worker_api:
    requests_per_minute: 1000
    burst_size: 100

  ai_service:
    requests_per_minute: 100
    burst_size: 10
    tokens_per_minute: 100000
```

### Rate Limiting Implementation

```typescript
interface RateLimitConfig {
  window_ms: number;
  max_requests: number;
  burst_size: number;
  key_prefix: string;
}

class RateLimiter {
  async checkLimit(key: string, config: RateLimitConfig): Promise<boolean>;
  async increment(key: string): Promise<void>;
  async getRemaining(key: string): Promise<number>;
}
```

## Error Handling

### Standard Error Response

```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
    request_id: string;
    timestamp: string;
  };
}

enum ErrorCodes {
  // Authentication errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_TOKEN = "INVALID_TOKEN",

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",

  // Resource errors
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",

  // System errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",

  // AI-specific errors
  AI_SERVICE_ERROR = "AI_SERVICE_ERROR",
  AI_RATE_LIMIT_EXCEEDED = "AI_RATE_LIMIT_EXCEEDED",

  // Proof-specific errors
  PROOF_FAILED = "PROOF_FAILED",
  PROOF_TIMEOUT = "PROOF_TIMEOUT",
  THEOREM_NOT_FOUND = "THEOREM_NOT_FOUND",
}
```

### Error Handling Middleware

```typescript
interface ErrorHandler {
  handle(error: Error, req: Request, res: Response): void;
  isOperational(error: Error): boolean;
  logError(error: Error, req: Request): void;
}
```

## Monitoring & Observability

### API Metrics

```typescript
interface APIMetrics {
  // Request metrics
  request_count: number;
  request_duration: number;
  request_size: number;
  response_size: number;

  // Error metrics
  error_count: number;
  error_rate: number;

  // Rate limiting metrics
  rate_limit_exceeded: number;

  // Authentication metrics
  auth_failures: number;
  token_expirations: number;
}
```

### Logging Format

```typescript
interface APILog {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  service: string;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number;
  user_id?: string;
  request_id: string;
  ip_address: string;
  user_agent: string;
  request_size: number;
  response_size: number;
  error?: string;
  metadata: Record<string, any>;
}
```

## Security Headers

### Standard Security Headers

```typescript
const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};
```

## API Versioning

### Versioning Strategy

```yaml
versioning:
  strategy: "URL path versioning"
  current_version: "v1"
  supported_versions: ["v1"]
  deprecation_policy:
    notice_period: "6 months"
    sunset_period: "12 months"
```

### Version Migration

```typescript
interface VersionMigration {
  from_version: string;
  to_version: string;
  breaking_changes: string[];
  migration_guide: string;
  deprecation_date: string;
  sunset_date: string;
}
```

## Testing

### API Testing Strategy

```typescript
interface APITest {
  name: string;
  endpoint: string;
  method: string;
  request: any;
  expected_response: any;
  expected_status: number;
  authentication?: boolean;
  rate_limiting?: boolean;
}

interface TestSuite {
  name: string;
  tests: APITest[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}
```

## Documentation

### OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: SpecCursor API
  version: 1.0.0
  description: API for SpecCursor dependency management system

servers:
  - url: https://api.speccursor.com/v1
    description: Production server
  - url: https://api-staging.speccursor.com/v1
    description: Staging server

security:
  - BearerAuth: []
  - ApiKeyAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
```

## Conclusion

This API specification provides a comprehensive framework for SpecCursor's internal and external APIs. The design prioritizes security, scalability, and maintainability while ensuring proper monitoring and observability.

### Implementation Checklist

- [ ] Implement JWT authentication middleware
- [ ] Set up rate limiting with Redis
- [ ] Configure mTLS for service-to-service communication
- [ ] Implement comprehensive error handling
- [ ] Set up API monitoring and alerting
- [ ] Create OpenAPI documentation
- [ ] Implement API versioning strategy
- [ ] Set up automated API testing
- [ ] Configure security headers
- [ ] Implement audit logging
