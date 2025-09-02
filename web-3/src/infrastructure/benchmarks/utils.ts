/**
 * Simple benchmark utilities
 * No external dependencies - just built-in Node.js tools
 */

export interface BenchmarkResult {
  name: string;
  runs: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface BenchmarkOptions {
  name: string;
  runs?: number;
  warmup?: number;
}

/**
 * Simple benchmark runner
 */
export async function benchmark(
  fn: () => Promise<void> | void,
  options: BenchmarkOptions
): Promise<BenchmarkResult> {
  const { name, runs = 100, warmup = 5 } = options;
  
  // Warmup runs
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  
  // Actual benchmark runs
  const times: number[] = [];
  
  for (let i = 0; i < runs; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    
    // Convert to milliseconds
    const duration = Number(end - start) / 1_000_000;
    times.push(duration);
  }
  
  // Calculate statistics
  times.sort((a, b) => a - b);
  
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const min = times[0]!;
  const max = times[times.length - 1]!;
  
  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * times.length) - 1;
    return times[index]!;
  };
  
  return {
    name,
    runs,
    avgTime: avg,
    minTime: min,
    maxTime: max,
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  };
}

/**
 * Format benchmark results as a table
 */
export function formatResults(results: BenchmarkResult[]): string {
  const header = [
    'Benchmark',
    'Runs',
    'Avg (ms)',
    'Min (ms)',
    'Max (ms)',
    'P50 (ms)',
    'P90 (ms)',
    'P95 (ms)',
    'P99 (ms)',
  ];
  
  const rows = results.map(r => [
    r.name,
    r.runs.toString(),
    r.avgTime.toFixed(2),
    r.minTime.toFixed(2),
    r.maxTime.toFixed(2),
    r.p50.toFixed(2),
    r.p90.toFixed(2),
    r.p95.toFixed(2),
    r.p99.toFixed(2),
  ]);
  
  // Calculate column widths
  const widths = header.map((h, i) => {
    const columnValues = [h, ...rows.map(r => r[i]!)];
    return Math.max(...columnValues.map(v => v.length));
  });
  
  // Build table
  const separator = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const formatRow = (row: string[]) =>
    '|' + row.map((cell, i) => ` ${cell.padEnd(widths[i]!)} `).join('|') + '|';
  
  const lines = [
    separator,
    formatRow(header),
    separator,
    ...rows.map(formatRow),
    separator,
  ];
  
  return lines.join('\n');
}

/**
 * Save benchmark results to file
 */
export async function saveBenchmarkResults(
  results: BenchmarkResult[],
  filename: string
): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const timestamp = new Date().toISOString();
  const data = {
    timestamp,
    results,
  };
  
  const dir = path.join(process.cwd(), 'benchmark-results');
  await fs.mkdir(dir, { recursive: true });
  
  const filepath = path.join(dir, `${filename}-${Date.now()}.json`);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  
  console.log(`Benchmark results saved to: ${filepath}`);
}

/**
 * Memory usage helper
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    rss: (usage.rss / 1024 / 1024).toFixed(2) + ' MB',
    external: (usage.external / 1024 / 1024).toFixed(2) + ' MB',
  };
}