import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const upgradeDuration = new Trend('upgrade_duration_seconds');
const upgradeSuccessRate = new Rate('upgrade_success_rate');
const aiTokensUsed = new Counter('ai_tokens_total');
const proofLatency = new Trend('proof_latency_seconds');

// Test configuration
export const options = {
  stages: [
    { duration: '5m', target: 500 }, // Ramp up to 500 VUs over 5 minutes
    { duration: '15m', target: 500 }, // Stay at 500 VUs for 15 minutes
    { duration: '2m', target: 0 }, // Ramp down to 0 VUs over 2 minutes
  ],
  thresholds: {
    'upgrade_duration_seconds': ['p95<=3'], // 95th percentile should be ≤ 3 seconds
    'upgrade_success_rate': ['rate>=0.999'], // Success rate should be ≥ 99.9%
    'http_req_duration': ['p95<=2000'], // HTTP requests should be ≤ 2 seconds
    'http_req_failed': ['rate<0.001'], // Error rate should be < 0.1%
    'proof_latency_seconds': ['p95<=5'], // Proof verification should be ≤ 5 seconds
    'ai_tokens_total': ['count<100000'], // Total AI tokens should be < 100k
  },
};

// Test data
const ecosystems = ['node', 'rust', 'python', 'go', 'dockerfile'];
const packages = [
  'express', 'react', 'lodash', 'axios', 'moment',
  'serde', 'tokio', 'reqwest', 'clap', 'rand',
  'requests', 'pandas', 'numpy', 'flask', 'django',
  'gin', 'echo', 'cobra', 'viper', 'testify'
];

// Helper functions
function getRandomEcosystem() {
  return ecosystems[Math.floor(Math.random() * ecosystems.length)];
}

function getRandomPackage() {
  return packages[Math.floor(Math.random() * packages.length)];
}

function generateVersion() {
  const major = Math.floor(Math.random() * 10) + 1;
  const minor = Math.floor(Math.random() * 20);
  const patch = Math.floor(Math.random() * 50);
  return `${major}.${minor}.${patch}`;
}

function generateTargetVersion(currentVersion) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  const newMajor = major + Math.floor(Math.random() * 2);
  const newMinor = minor + Math.floor(Math.random() * 5);
  const newPatch = patch + Math.floor(Math.random() * 10);
  return `${newMajor}.${newMinor}.${newPatch}`;
}

// Main test function
export default function() {
  const baseUrl = __ENV.K6_BROKER_URL || 'http://localhost:8080';
  const ecosystem = getRandomEcosystem();
  const packageName = getRandomPackage();
  const currentVersion = generateVersion();
  const targetVersion = generateTargetVersion(currentVersion);

  // Step 1: Create upgrade
  const createStart = Date.now();
  const createResponse = http.post(`${baseUrl}/api/v1/upgrades`, JSON.stringify({
    repository: 'test/repo',
    ecosystem: ecosystem,
    packageName: packageName,
    currentVersion: currentVersion,
    targetVersion: targetVersion,
    metadata: {
      testRun: true,
      loadTest: true,
      timestamp: new Date().toISOString(),
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.GITHUB_TOKEN || 'test-token'}`,
    },
  });

  check(createResponse, {
    'create upgrade status is 201': (r) => r.status === 201,
    'create upgrade response has upgrade ID': (r) => r.json('id') !== undefined,
  });

  const createDuration = (Date.now() - createStart) / 1000;
  upgradeDuration.add(createDuration);

  if (createResponse.status === 201) {
    upgradeSuccessRate.add(1);
    const upgradeId = createResponse.json('id');

    // Step 2: Poll for upgrade status
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    let upgradeCompleted = false;

    while (attempts < maxAttempts && !upgradeCompleted) {
      const statusResponse = http.get(`${baseUrl}/api/v1/upgrades/${upgradeId}`, {
        headers: {
          'Authorization': `Bearer ${__ENV.GITHUB_TOKEN || 'test-token'}`,
        },
      });

      check(statusResponse, {
        'get upgrade status is 200': (r) => r.status === 200,
        'upgrade status is valid': (r) => ['pending', 'processing', 'completed', 'failed'].includes(r.json('status')),
      });

      if (statusResponse.status === 200) {
        const status = statusResponse.json('status');
        if (status === 'completed' || status === 'failed') {
          upgradeCompleted = true;
          
          // Record AI tokens if available
          const aiTokens = statusResponse.json('metadata.ai_tokens_used');
          if (aiTokens) {
            aiTokensUsed.add(aiTokens);
          }

          // Record proof latency if available
          const proofTime = statusResponse.json('metadata.proof_verification_time');
          if (proofTime) {
            proofLatency.add(proofTime / 1000); // Convert to seconds
          }
        }
      }

      if (!upgradeCompleted) {
        sleep(1); // Wait 1 second before next poll
        attempts++;
      }
    }

    if (!upgradeCompleted) {
      upgradeSuccessRate.add(0); // Mark as failed if timeout
    }

    // Step 3: Get upgrade details
    const detailsResponse = http.get(`${baseUrl}/api/v1/upgrades/${upgradeId}/details`, {
      headers: {
        'Authorization': `Bearer ${__ENV.GITHUB_TOKEN || 'test-token'}`,
      },
    });

    check(detailsResponse, {
      'get upgrade details is 200': (r) => r.status === 200,
      'upgrade details has required fields': (r) => {
        const data = r.json();
        return data.id && data.repository && data.ecosystem && data.packageName;
      },
    });

    // Step 4: List upgrades (pagination test)
    const listResponse = http.get(`${baseUrl}/api/v1/upgrades?limit=10&offset=0`, {
      headers: {
        'Authorization': `Bearer ${__ENV.GITHUB_TOKEN || 'test-token'}`,
      },
    });

    check(listResponse, {
      'list upgrades is 200': (r) => r.status === 200,
      'list upgrades has pagination': (r) => {
        const data = r.json();
        return data.upgrades && Array.isArray(data.upgrades) && 
               data.total !== undefined && data.limit !== undefined;
      },
    });

    // Step 5: Health check
    const healthResponse = http.get(`${baseUrl}/health`);
    check(healthResponse, {
      'health check is 200': (r) => r.status === 200,
      'health check shows healthy': (r) => r.json('status') === 'healthy',
    });

    // Step 6: Metrics endpoint
    const metricsResponse = http.get(`${baseUrl}/metrics`);
    check(metricsResponse, {
      'metrics endpoint is 200': (r) => r.status === 200,
      'metrics contain upgrade metrics': (r) => r.body.includes('upgrade_duration_seconds'),
    });

  } else {
    upgradeSuccessRate.add(0); // Mark as failed
  }

  // Random sleep between requests to simulate real user behavior
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function to initialize test data
export function setup() {
  const baseUrl = __ENV.K6_BROKER_URL || 'http://localhost:8080';
  
  // Verify the service is ready
  const healthResponse = http.get(`${baseUrl}/health`);
  check(healthResponse, {
    'setup: service is healthy': (r) => r.status === 200 && r.json('status') === 'healthy',
  });

  console.log('Load test setup completed');
  return { baseUrl };
}

// Teardown function to clean up
export function teardown(data) {
  console.log('Load test teardown completed');
}

// Handle test completion
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
} 