#!/usr/bin/env node

const fs = require('fs');

/**
 * Parse k6 load test results and validate against performance budgets
 */
class LoadTestParser {
  constructor() {
    this.results = {};
    this.budgets = {};
    this.violations = [];
  }

  /**
   * Load and parse k6 results from JSON file
   */
  loadResults(inputFile) {
    try {
      const data = fs.readFileSync(inputFile, 'utf8');
      this.results = JSON.parse(data);
      console.log(`✅ Loaded k6 results from ${inputFile}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load k6 results: ${error.message}`);
      return false;
    }
  }

  /**
   * Load performance budgets from JSON file
   */
  loadBudgets(budgetFile) {
    try {
      const data = fs.readFileSync(budgetFile, 'utf8');
      this.budgets = JSON.parse(data);
      console.log(`✅ Loaded performance budgets from ${budgetFile}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load budgets: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract metrics from k6 results
   */
  extractMetrics() {
    const metrics = {
      http_req_duration: this.results.metrics?.http_req_duration,
      http_req_failed: this.results.metrics?.http_req_failed,
      upgrade_duration_seconds: this.results.metrics?.upgrade_duration_seconds,
      proof_latency_seconds: this.results.metrics?.proof_latency_seconds,
      ai_tokens_total: this.results.metrics?.ai_tokens_total,
      upgrade_success_rate: this.results.metrics?.upgrade_success_rate,
    };

    return metrics;
  }

  /**
   * Calculate percentiles from histogram data
   */
  calculatePercentiles(histogram, percentiles = [50, 95, 99]) {
    if (!histogram || !histogram.values) {
      return null;
    }

    const values = [];
    for (const [bucket, count] of Object.entries(histogram.values)) {
      for (let i = 0; i < count; i++) {
        values.push(parseFloat(bucket));
      }
    }

    if (values.length === 0) {
      return null;
    }

    values.sort((a, b) => a - b);
    const result = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * values.length) - 1;
      result[`p${p}`] = values[index];
    }

    return result;
  }

  /**
   * Validate metrics against budgets
   */
  validateMetrics(scenario) {
    const metrics = this.extractMetrics();
    const scenarioBudgets = this.budgets[scenario];

    if (!scenarioBudgets) {
      console.warn(`⚠️  No budgets found for scenario: ${scenario}`);
      return false;
    }

    console.log(`\n🔍 Validating ${scenario} metrics against budgets:`);

    // Validate latency metrics
    if (metrics.http_req_duration) {
      const percentiles = this.calculatePercentiles(metrics.http_req_duration);
      if (percentiles) {
        this.validateLatency(
          'http_req_duration',
          percentiles,
          scenarioBudgets.latency
        );
      }
    }

    if (metrics.upgrade_duration_seconds) {
      const percentiles = this.calculatePercentiles(
        metrics.upgrade_duration_seconds
      );
      if (percentiles) {
        this.validateLatency(
          'upgrade_duration_seconds',
          percentiles,
          scenarioBudgets.latency
        );
      }
    }

    if (metrics.proof_latency_seconds) {
      const percentiles = this.calculatePercentiles(
        metrics.proof_latency_seconds
      );
      if (percentiles) {
        this.validateLatency(
          'proof_latency_seconds',
          percentiles,
          scenarioBudgets.proof_verification?.latency_seconds
        );
      }
    }

    // Validate error rate
    if (metrics.http_req_failed) {
      this.validateErrorRate(
        metrics.http_req_failed,
        scenarioBudgets.error_rate
      );
    }

    if (metrics.upgrade_success_rate) {
      this.validateSuccessRate(
        metrics.upgrade_success_rate,
        scenarioBudgets.success_rate
      );
    }

    // Validate throughput
    if (this.results.metrics?.http_reqs) {
      this.validateThroughput(
        this.results.metrics.http_reqs,
        scenarioBudgets.throughput
      );
    }

    // Validate AI token usage
    if (metrics.ai_tokens_total) {
      this.validateTokenUsage(
        metrics.ai_tokens_total,
        scenarioBudgets.ai_tokens
      );
    }

    return this.violations.length === 0;
  }

  /**
   * Validate latency percentiles
   */
  validateLatency(metricName, percentiles, budget) {
    if (!budget) return;

    console.log(`  📊 ${metricName}:`);
    for (const [p, value] of Object.entries(percentiles)) {
      const budgetValue = budget[p];
      if (budgetValue && value > budgetValue) {
        const violation = {
          metric: metricName,
          percentile: p,
          actual: value,
          budget: budgetValue,
          violation: `${p}th percentile ${value}ms exceeds budget ${budgetValue}ms`,
        };
        this.violations.push(violation);
        console.log(
          `    ❌ ${p}th percentile: ${value}ms > ${budgetValue}ms (BUDGET VIOLATION)`
        );
      } else {
        console.log(
          `    ✅ ${p}th percentile: ${value}ms ≤ ${budgetValue || 'N/A'}ms`
        );
      }
    }
  }

  /**
   * Validate error rate
   */
  validateErrorRate(errorMetric, budget) {
    if (!budget || !errorMetric) return;

    const errorRate = errorMetric.rate || 0;
    const maxErrorRate = budget.max || 0.001;

    console.log(`  📊 Error Rate: ${(errorRate * 100).toFixed(3)}%`);
    if (errorRate > maxErrorRate) {
      const violation = {
        metric: 'error_rate',
        actual: errorRate,
        budget: maxErrorRate,
        violation: `Error rate ${(errorRate * 100).toFixed(3)}% exceeds budget ${(maxErrorRate * 100).toFixed(3)}%`,
      };
      this.violations.push(violation);
      console.log(
        `    ❌ Error rate ${(errorRate * 100).toFixed(3)}% > ${(maxErrorRate * 100).toFixed(3)}% (BUDGET VIOLATION)`
      );
    } else {
      console.log(
        `    ✅ Error rate ${(errorRate * 100).toFixed(3)}% ≤ ${(maxErrorRate * 100).toFixed(3)}%`
      );
    }
  }

  /**
   * Validate success rate
   */
  validateSuccessRate(successMetric, budget) {
    if (!budget || !successMetric) return;

    const successRate = successMetric.rate || 0;
    const minSuccessRate = budget.min || 0.999;

    console.log(`  📊 Success Rate: ${(successRate * 100).toFixed(3)}%`);
    if (successRate < minSuccessRate) {
      const violation = {
        metric: 'success_rate',
        actual: successRate,
        budget: minSuccessRate,
        violation: `Success rate ${(successRate * 100).toFixed(3)}% below budget ${(minSuccessRate * 100).toFixed(3)}%`,
      };
      this.violations.push(violation);
      console.log(
        `    ❌ Success rate ${(successRate * 100).toFixed(3)}% < ${(minSuccessRate * 100).toFixed(3)}% (BUDGET VIOLATION)`
      );
    } else {
      console.log(
        `    ✅ Success rate ${(successRate * 100).toFixed(3)}% ≥ ${(minSuccessRate * 100).toFixed(3)}%`
      );
    }
  }

  /**
   * Validate throughput
   */
  validateThroughput(throughputMetric, budget) {
    if (!budget || !throughputMetric) return;

    const rate = throughputMetric.rate || 0;
    const minRate = budget.requests_per_second?.min || 50;

    console.log(`  📊 Throughput: ${rate.toFixed(2)} req/s`);
    if (rate < minRate) {
      const violation = {
        metric: 'throughput',
        actual: rate,
        budget: minRate,
        violation: `Throughput ${rate.toFixed(2)} req/s below budget ${minRate} req/s`,
      };
      this.violations.push(violation);
      console.log(
        `    ❌ Throughput ${rate.toFixed(2)} req/s < ${minRate} req/s (BUDGET VIOLATION)`
      );
    } else {
      console.log(
        `    ✅ Throughput ${rate.toFixed(2)} req/s ≥ ${minRate} req/s`
      );
    }
  }

  /**
   * Validate AI token usage
   */
  validateTokenUsage(tokenMetric, budget) {
    if (!budget || !tokenMetric) return;

    const totalTokens = tokenMetric.count || 0;
    const maxTokens = budget.total?.max || 100000;

    console.log(`  📊 AI Tokens: ${totalTokens.toLocaleString()}`);
    if (totalTokens > maxTokens) {
      const violation = {
        metric: 'ai_tokens_total',
        actual: totalTokens,
        budget: maxTokens,
        violation: `AI tokens ${totalTokens.toLocaleString()} exceeds budget ${maxTokens.toLocaleString()}`,
      };
      this.violations.push(violation);
      console.log(
        `    ❌ AI tokens ${totalTokens.toLocaleString()} > ${maxTokens.toLocaleString()} (BUDGET VIOLATION)`
      );
    } else {
      console.log(
        `    ✅ AI tokens ${totalTokens.toLocaleString()} ≤ ${maxTokens.toLocaleString()}`
      );
    }
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    console.log('\n📋 Load Test Summary:');
    console.log('=' * 50);

    if (this.violations.length === 0) {
      console.log('✅ All performance budgets met!');
      return true;
    } else {
      console.log(`❌ ${this.violations.length} budget violation(s) found:`);
      for (const violation of this.violations) {
        console.log(`  • ${violation.violation}`);
      }
      return false;
    }
  }

  /**
   * Export results to JSON
   */
  exportResults(outputFile) {
    const report = {
      timestamp: new Date().toISOString(),
      scenario: this.scenario,
      results: this.results,
      violations: this.violations,
      summary: {
        total_violations: this.violations.length,
        passed: this.violations.length === 0,
        metrics_analyzed: Object.keys(this.extractMetrics()).length,
      },
    };

    try {
      fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
      console.log(`✅ Exported results to ${outputFile}`);
    } catch (error) {
      console.error(`❌ Failed to export results: ${error.message}`);
    }
  }
}

/**
 * Main function
 */
function main() {
  const parser = new LoadTestParser();

  // Parse command line arguments
  const args = process.argv.slice(2);
  let inputFile, budgetFile, scenario, outputFile;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        inputFile = args[++i];
        break;
      case '--budget':
        budgetFile = args[++i];
        break;
      case '--scenario':
        scenario = args[++i];
        break;
      case '--output':
        outputFile = args[++i];
        break;
      case '--help':
        console.log(`
Usage: node parse-load-results.js [options]

Options:
  --input <file>     k6 results JSON file
  --budget <file>    Performance budgets JSON file
  --scenario <name>  Test scenario name
  --output <file>    Output report file
  --help            Show this help message

Example:
  node parse-load-results.js \\
    --input load-results-upgrade-workflow.json \\
    --budget load/budgets.json \\
    --scenario upgrade-workflow \\
    --output load-report.json
        `);
        process.exit(0);
    }
  }

  // Validate required arguments
  if (!inputFile || !budgetFile || !scenario) {
    console.error('❌ Missing required arguments. Use --help for usage.');
    process.exit(1);
  }

  // Load and validate files
  if (!parser.loadResults(inputFile)) {
    process.exit(1);
  }

  if (!parser.loadBudgets(budgetFile)) {
    process.exit(1);
  }

  parser.scenario = scenario;

  // Validate metrics against budgets
  const passed = parser.validateMetrics(scenario);

  // Generate summary
  parser.generateSummary();

  // Export results if output file specified
  if (outputFile) {
    parser.exportResults(outputFile);
  }

  // Exit with appropriate code
  process.exit(passed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = LoadTestParser;
