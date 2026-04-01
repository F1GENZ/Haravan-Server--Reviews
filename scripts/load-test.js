/**
 * ══════════════════════════════════════════════
 *  F1GENZ Review — Server Load Test
 * ══════════════════════════════════════════════
 *
 * Test khả năng chịu tải NestJS + Redis.
 * Chạy: node scripts/load-test.js
 *
 * Không cần cài thêm package — dùng native Node.js HTTP.
 */

const http = require('http');

const BASE = process.env.BASE_URL || 'http://localhost:3333';
const API = `${BASE}/api`;

// ── Config ──
const SCENARIOS = [
  { name: 'Warm-up',           concurrency: 10,   requests: 50    },
  { name: 'Light load',        concurrency: 50,   requests: 200   },
  { name: 'Medium load',       concurrency: 100,  requests: 500   },
  { name: 'Heavy load',        concurrency: 200,  requests: 1000  },
  { name: 'Spike test',        concurrency: 500,  requests: 2000  },
  { name: 'Stress test',       concurrency: 1000, requests: 5000  },
];

// Endpoints to test (mix of routes)
const PRODUCT_IDS = ['1021489326', '1021489327', '1021489328', 'non-existent-product'];
const ENDPOINTS = [
  ...PRODUCT_IDS.map(id => `/public/reviews/${id}`),
  ...PRODUCT_IDS.map(id => `/public/reviews/${id}/summary`),
  ...PRODUCT_IDS.map(id => `/public/qna/${id}`),
  ...PRODUCT_IDS.map(id => `/public/qna/${id}/summary`),
];

// ── Utilities ──
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;
const fmt = (n) => n.toLocaleString('vi-VN');
const fmtMs = (ms) => ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
const bar = (pct, width = 30) => {
  const filled = Math.round(pct / 100 * width);
  const empty = width - filled;
  const color = pct >= 99 ? 'green' : pct >= 95 ? 'yellow' : 'red';
  return c(color, '█'.repeat(filled)) + c('dim', '░'.repeat(empty));
};

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

// ── HTTP Request ──
function makeRequest(url) {
  return new Promise((resolve) => {
    const start = performance.now();
    const parsedUrl = new URL(url);

    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'GET',
      timeout: 30000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          latency: performance.now() - start,
          size: Buffer.byteLength(body),
          ok: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    req.on('error', () => {
      resolve({
        status: 0,
        latency: performance.now() - start,
        size: 0,
        ok: false,
        error: true,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        latency: performance.now() - start,
        size: 0,
        ok: false,
        error: true,
        timeout: true,
      });
    });

    req.end();
  });
}

// ── Run Scenario ──
async function runScenario({ name, concurrency, requests }) {
  console.log(`\n${c('bold', c('cyan', `▶ ${name}`))}  ${c('dim', `(${fmt(concurrency)} concurrent × ${fmt(requests)} total)`)}`);

  const results = [];
  let completed = 0;
  let queued = 0;
  const startTime = performance.now();

  // Progress bar
  const showProgress = () => {
    const pct = Math.floor(completed / requests * 100);
    const elapsed = fmtMs(performance.now() - startTime);
    process.stdout.write(`\r  ${bar(pct)} ${pct}%  ${c('dim', `${fmt(completed)}/${fmt(requests)}`)}  ${c('dim', elapsed)}    `);
  };

  const interval = setInterval(showProgress, 200);

  // Semaphore pattern for concurrency control
  const runNext = async () => {
    while (queued < requests) {
      const idx = queued++;
      const endpoint = ENDPOINTS[idx % ENDPOINTS.length];
      const result = await makeRequest(`${API}${endpoint}`);
      result.endpoint = endpoint;
      results.push(result);
      completed++;
    }
  };

  // Launch concurrent workers
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, requests); i++) {
    workers.push(runNext());
  }

  await Promise.all(workers);
  const totalTime = performance.now() - startTime;

  clearInterval(interval);
  showProgress();
  console.log('');

  // ── Analyze ──
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  const errors = results.filter(r => r.error);
  const timeouts = results.filter(r => r.timeout);
  const latencies = results.map(r => r.latency);
  const totalBytes = results.reduce((s, r) => s + r.size, 0);

  const successRate = (ok.length / results.length * 100);
  const rps = results.length / (totalTime / 1000);

  // Status code breakdown
  const statusMap = {};
  for (const r of results) {
    statusMap[r.status] = (statusMap[r.status] || 0) + 1;
  }

  // Per-endpoint breakdown
  const epMap = {};
  for (const r of results) {
    if (!epMap[r.endpoint]) epMap[r.endpoint] = { ok: 0, fail: 0, latencies: [] };
    if (r.ok) epMap[r.endpoint].ok++;
    else epMap[r.endpoint].fail++;
    epMap[r.endpoint].latencies.push(r.latency);
  }

  console.log(`  ${c('bold', 'Results:')}`);
  console.log(`    Success rate:  ${bar(successRate, 20)} ${successRate >= 99 ? c('green', `${successRate.toFixed(1)}%`) : successRate >= 95 ? c('yellow', `${successRate.toFixed(1)}%`) : c('red', `${successRate.toFixed(1)}%`)}`);
  console.log(`    Throughput:    ${c('bold', c('green', `${rps.toFixed(0)} req/s`))}`);
  console.log(`    Total time:    ${fmtMs(totalTime)}`);
  console.log(`    Data transfer: ${(totalBytes / 1024).toFixed(1)} KB`);
  console.log('');
  console.log(`  ${c('bold', 'Latency:')}`);
  console.log(`    Min:    ${c('green', fmtMs(Math.min(...latencies)))}`);
  console.log(`    Avg:    ${fmtMs(latencies.reduce((s, l) => s + l, 0) / latencies.length)}`);
  console.log(`    P50:    ${fmtMs(percentile(latencies, 50))}`);
  console.log(`    P90:    ${c('yellow', fmtMs(percentile(latencies, 90)))}`);
  console.log(`    P99:    ${c('red', fmtMs(percentile(latencies, 99)))}`);
  console.log(`    Max:    ${c('red', fmtMs(Math.max(...latencies)))}`);
  console.log('');
  console.log(`  ${c('bold', 'Status codes:')}`);
  for (const [code, count] of Object.entries(statusMap).sort()) {
    const label = code === '200' ? c('green', code) : code === '0' ? c('red', 'ERR') : c('yellow', code);
    console.log(`    ${label}: ${fmt(count)}`);
  }

  if (fail.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'Failures:'))}  ${c('red', `${fmt(fail.length)} failed`)}  ${errors.length ? c('red', `(${errors.length} connection errors)`) : ''}  ${timeouts.length ? c('yellow', `(${timeouts.length} timeouts)`) : ''}`);
  }

  return {
    name,
    concurrency,
    requests,
    successRate,
    rps,
    totalTime,
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    p99: percentile(latencies, 99),
    max: Math.max(...latencies),
    fail: fail.length,
  };
}

// ── Health check ──
async function healthCheck() {
  console.log(`\n${c('dim', `Target: ${API}`)}`);
  console.log(`${c('dim', 'Checking server...')}`);
  try {
    const result = await makeRequest(`${API}/public/reviews/test-health`);
    if (result.error) throw new Error('Connection refused');
    console.log(`${c('green', '✓ Server is reachable')} ${c('dim', `(${fmtMs(result.latency)})`)}\n`);
    return true;
  } catch {
    console.log(`${c('red', '✗ Server is not reachable at')} ${API}`);
    console.log(`${c('dim', '  Make sure the server is running: npm run start:dev')}\n`);
    return false;
  }
}

// ── Summary table ──
function printSummary(results) {
  console.log(`\n${'═'.repeat(95)}`);
  console.log(c('bold', c('cyan', '  LOAD TEST SUMMARY')));
  console.log(`${'═'.repeat(95)}`);
  console.log(c('dim', `  ${'Scenario'.padEnd(18)} ${'Conc'.padStart(6)} ${'Reqs'.padStart(7)} ${'Rate'.padStart(7)} ${'RPS'.padStart(8)} ${'P50'.padStart(8)} ${'P90'.padStart(8)} ${'P99'.padStart(8)} ${'Max'.padStart(8)} ${'Fail'.padStart(6)}`));
  console.log(c('dim', `  ${'─'.repeat(93)}`));

  for (const r of results) {
    const rateColor = r.successRate >= 99 ? 'green' : r.successRate >= 95 ? 'yellow' : 'red';
    const rpsColor = r.rps >= 500 ? 'green' : r.rps >= 100 ? 'yellow' : 'red';
    const p99Color = r.p99 < 200 ? 'green' : r.p99 < 1000 ? 'yellow' : 'red';
    const failColor = r.fail === 0 ? 'green' : r.fail < 10 ? 'yellow' : 'red';

    console.log(
      `  ${r.name.padEnd(18)} ` +
      `${fmt(r.concurrency).padStart(6)} ` +
      `${fmt(r.requests).padStart(7)} ` +
      `${c(rateColor, `${r.successRate.toFixed(1)}%`.padStart(7))} ` +
      `${c(rpsColor, `${r.rps.toFixed(0)}`.padStart(8))} ` +
      `${fmtMs(r.p50).padStart(8)} ` +
      `${c('yellow', fmtMs(r.p90).padStart(8))} ` +
      `${c(p99Color, fmtMs(r.p99).padStart(8))} ` +
      `${c('red', fmtMs(r.max).padStart(8))} ` +
      `${c(failColor, `${r.fail}`.padStart(6))}`
    );
  }
  console.log(`${'═'.repeat(95)}\n`);

  // Verdict
  const lastResult = results[results.length - 1];
  const maxRps = Math.max(...results.map(r => r.rps));
  const allPassed = results.every(r => r.successRate >= 99);
  const stressPassed = lastResult && lastResult.successRate >= 95;

  console.log(c('bold', '  Verdict:'));
  console.log(`    Peak throughput: ${c('bold', c('green', `${maxRps.toFixed(0)} req/s`))}`);
  if (allPassed) {
    console.log(`    ${c('bgGreen', c('white', ' PASS '))} Server handles all scenarios with 99%+ success rate`);
  } else if (stressPassed) {
    console.log(`    ${c('bgYellow', c('white', ' WARN '))} Server degrades under heavy load but maintains 95%+ success`);
  } else {
    console.log(`    ${c('bgRed', c('white', ' FAIL '))} Server fails under stress — consider optimizing or scaling`);
  }
  console.log('');
}

// ── Main ──
async function main() {
  console.log(`\n${c('bold', c('cyan', '══════════════════════════════════════════════'))}`);
  console.log(`${c('bold', c('cyan', '  F1GENZ Review — Server Load Test'))}`);
  console.log(`${c('bold', c('cyan', '══════════════════════════════════════════════'))}`);

  const isUp = await healthCheck();
  if (!isUp) process.exit(1);

  const results = [];
  for (const scenario of SCENARIOS) {
    const result = await runScenario(scenario);
    results.push(result);

    // If success rate drops below 80%, abort remaining
    if (result.successRate < 80) {
      console.log(`\n  ${c('red', '⚠ Success rate dropped below 80% — aborting remaining scenarios')}`);
      break;
    }

    // Brief pause between scenarios
    await new Promise(r => setTimeout(r, 1000));
  }

  printSummary(results);
}

main().catch(console.error);
