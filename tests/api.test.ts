/**
 * Basic API tests for Arbordex
 * Run with: npm test
 * 
 * Set TEST_BASE_URL environment variable to test against different endpoints:
 * TEST_BASE_URL=http://localhost:4000 npm test
 * TEST_BASE_URL=https://staging.example.com npm test
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function testGetRoot(): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/`);
    const data = await response.text();

    if (response.status === 200 && data.includes('Hello')) {
      results.push({ name: 'GET /', passed: true });
    } else {
      results.push({
        name: 'GET /',
        passed: false,
        error: `Unexpected response: ${data}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'GET /',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function runTests(): Promise<void> {
  console.log('Starting API tests...\n');
  await testGetRoot();

  console.log('Test Results:');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  results.forEach((result) => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${result.name}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    result.passed ? passed++ : failed++;
  });

  console.log('='.repeat(50));
  console.log(`\nTotal: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
