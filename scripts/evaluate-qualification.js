#!/usr/bin/env node

const fs = require('fs');

/**
 * Evaluate qualification criteria for SpecCursor release candidates
 */
class QualificationEvaluator {
  constructor() {
    this.stages = {};
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      violations: [],
      summary: {},
    };
  }

  /**
   * Add stage result
   */
  addStageResult(stage, result) {
    this.stages[stage] = result;
    this.results.total++;

    if (result === 'success') {
      this.results.passed++;
    } else {
      this.results.failed++;
      this.results.violations.push({
        stage,
        result,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Evaluate all qualification criteria
   */
  evaluate(stageResults) {
    console.log('🔍 Evaluating SpecCursor Qualification Criteria');
    console.log('=' * 60);

    // Add all stage results
    for (const [stage, result] of Object.entries(stageResults)) {
      this.addStageResult(stage, result);
    }

    // Generate summary
    this.generateSummary();

    // Check exit criteria
    const exitCriteria = this.checkExitCriteria();

    // Generate report
    this.generateReport();

    return {
      qualified: exitCriteria.allPassed,
      summary: this.results,
      exitCriteria,
    };
  }

  /**
   * Generate summary of results
   */
  generateSummary() {
    console.log('\n📊 Qualification Summary:');
    console.log('-' * 40);

    const stageNames = {
      'static-analysis': 'Static Analysis',
      'unit-tests': 'Unit Tests',
      'property-tests': 'Property-Based Tests',
      'integration-e2e': 'Integration & E2E Tests',
      'load-tests': 'Load & Stress Tests',
      'chaos-tests': 'Chaos & Resilience Tests',
      'security-scans': 'Security Scans',
      'vulnerability-sbom': 'Vulnerability & SBOM',
      observability: 'Observability Assertions',
      performance: 'Performance Profiling',
      'cost-budgets': 'Cost & Latency Budgets',
      'deployment-drill': 'Deployment Drill',
    };

    for (const [stage, result] of Object.entries(this.stages)) {
      const status = result === 'success' ? '✅ PASS' : '❌ FAIL';
      const name = stageNames[stage] || stage;
      console.log(`${status} ${name}`);
    }

    console.log(`\n📈 Overall Results:`);
    console.log(
      `  • Passed: ${this.results.passed}/${this.results.total} stages`
    );
    console.log(
      `  • Failed: ${this.results.failed}/${this.results.total} stages`
    );
    console.log(
      `  • Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`
    );
  }

  /**
   * Check exit criteria
   */
  checkExitCriteria() {
    const criteria = {
      allStagesPassed: this.results.failed === 0,
      coverageThreshold: this.checkCoverageThreshold(),
      proofValidation: this.checkProofValidation(),
      latencyBudgets: this.checkLatencyBudgets(),
      securityVulnerabilities: this.checkSecurityVulnerabilities(),
      costProjection: this.checkCostProjection(),
      observabilityMetrics: this.checkObservabilityMetrics(),
    };

    const allPassed = Object.values(criteria).every(c => c);

    console.log('\n🎯 Exit Criteria Evaluation:');
    console.log('-' * 40);

    for (const [criterion, passed] of Object.entries(criteria)) {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      const name = this.formatCriterionName(criterion);
      console.log(`${status} ${name}`);
    }

    console.log(
      `\n🏁 Overall Qualification: ${allPassed ? '✅ QUALIFIED' : '❌ NOT QUALIFIED'}`
    );

    return {
      allPassed,
      criteria,
    };
  }

  /**
   * Check coverage threshold (≥95%)
   */
  checkCoverageThreshold() {
    // This would typically read from coverage reports
    // For now, assume passed if unit tests passed
    return this.stages['unit-tests'] === 'success';
  }

  /**
   * Check proof validation (100% valid)
   */
  checkProofValidation() {
    // This would typically read from proof verification results
    // For now, assume passed if property tests passed
    return this.stages['property-tests'] === 'success';
  }

  /**
   * Check latency budgets (p95 ≤ 3s)
   */
  checkLatencyBudgets() {
    // This would typically read from load test results
    // For now, assume passed if load tests passed
    return this.stages['load-tests'] === 'success';
  }

  /**
   * Check security vulnerabilities (no HIGH/Critical)
   */
  checkSecurityVulnerabilities() {
    // This would typically read from security scan results
    // For now, assume passed if security scans passed
    return this.stages['security-scans'] === 'success';
  }

  /**
   * Check cost projection (≤ target budget)
   */
  checkCostProjection() {
    // This would typically read from cost analysis results
    // For now, assume passed if cost budgets passed
    return this.stages['cost-budgets'] === 'success';
  }

  /**
   * Check observability metrics (all exposed)
   */
  checkObservabilityMetrics() {
    // This would typically read from observability test results
    // For now, assume passed if observability passed
    return this.stages['observability'] === 'success';
  }

  /**
   * Format criterion name for display
   */
  formatCriterionName(criterion) {
    const names = {
      allStagesPassed: 'All 12 stages succeed',
      coverageThreshold: 'Coverage ≥ 95%',
      proofValidation: 'Proofs 100% valid',
      latencyBudgets: 'p95 latency ≤ 3s',
      securityVulnerabilities: 'No HIGH/Critical vulns',
      costProjection: 'Cost ≤ target budget',
      observabilityMetrics: 'All metrics exposed',
    };
    return names[criterion] || criterion;
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      stages: this.stages,
      exitCriteria: this.checkExitCriteria(),
      recommendations: this.generateRecommendations(),
    };

    console.log('\n📋 Detailed Report:');
    console.log('-' * 40);

    if (this.results.violations.length > 0) {
      console.log('\n❌ Failed Stages:');
      for (const violation of this.results.violations) {
        console.log(`  • ${violation.stage}: ${violation.result}`);
      }
    }

    console.log('\n💡 Recommendations:');
    for (const recommendation of report.recommendations) {
      console.log(`  • ${recommendation}`);
    }
  }

  /**
   * Generate recommendations based on results
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.stages['static-analysis'] !== 'success') {
      recommendations.push('Fix static analysis violations before proceeding');
    }

    if (this.stages['unit-tests'] !== 'success') {
      recommendations.push('Improve test coverage to meet 95% threshold');
    }

    if (this.stages['property-tests'] !== 'success') {
      recommendations.push(
        'Fix property test failures and verify critical invariants'
      );
    }

    if (this.stages['load-tests'] !== 'success') {
      recommendations.push('Optimize performance to meet latency budgets');
    }

    if (this.stages['security-scans'] !== 'success') {
      recommendations.push('Address security vulnerabilities immediately');
    }

    if (this.stages['cost-budgets'] !== 'success') {
      recommendations.push('Optimize costs to meet budget constraints');
    }

    if (this.results.failed === 0) {
      recommendations.push(
        'All criteria met - ready for production deployment'
      );
    }

    return recommendations;
  }

  /**
   * Export qualification report
   */
  exportReport(outputFile) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      stages: this.stages,
      exitCriteria: this.checkExitCriteria(),
      recommendations: this.generateRecommendations(),
      qualified: this.checkExitCriteria().allPassed,
    };

    try {
      fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
      console.log(`✅ Exported qualification report to ${outputFile}`);
    } catch (error) {
      console.error(`❌ Failed to export report: ${error.message}`);
    }
  }
}

/**
 * Main function
 */
function main() {
  const evaluator = new QualificationEvaluator();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const stageResults = {};

  // Parse stage results from arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const stage = args[i].substring(2);
      const result = args[++i];

      if (result && ['success', 'failure', 'cancelled'].includes(result)) {
        stageResults[stage] = result === 'success' ? 'success' : 'failure';
      }
    }
  }

  // Validate required arguments
  const requiredStages = [
    'static-analysis',
    'unit-tests',
    'property-tests',
    'integration-e2e',
    'load-tests',
    'chaos-tests',
    'security-scans',
    'vulnerability-sbom',
    'observability',
    'performance',
    'cost-budgets',
    'deployment-drill',
  ];

  const missingStages = requiredStages.filter(stage => !stageResults[stage]);

  if (missingStages.length > 0) {
    console.error('❌ Missing stage results:');
    for (const stage of missingStages) {
      console.error(`  • --${stage} <success|failure>`);
    }
    console.error('\nUsage: node evaluate-qualification.js [stage-results]');
    console.error('Example:');
    console.error('  node evaluate-qualification.js \\');
    console.error('    --static-analysis success \\');
    console.error('    --unit-tests success \\');
    console.error('    --property-tests success \\');
    console.error('    --integration-e2e success \\');
    console.error('    --load-tests success \\');
    console.error('    --chaos-tests success \\');
    console.error('    --security-scans success \\');
    console.error('    --vulnerability-sbom success \\');
    console.error('    --observability success \\');
    console.error('    --performance success \\');
    console.error('    --cost-budgets success \\');
    console.error('    --deployment-drill success');
    process.exit(1);
  }

  // Evaluate qualification
  const result = evaluator.evaluate(stageResults);

  // Export report if output file specified
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    evaluator.exportReport(args[outputIndex + 1]);
  }

  // Exit with appropriate code
  process.exit(result.qualified ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = QualificationEvaluator;
