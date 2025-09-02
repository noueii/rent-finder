#!/usr/bin/env tsx

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { cpus } from 'os';

interface Config {
  inputFile: string;
  concurrency: number;
  timeout: number;
  quickMode: boolean;
  saveInterval: number;
}

class UltraFastProxyTester {
  private config: Config;
  private workingProxies: Set<string> = new Set();
  private tested = 0;
  private startTime = Date.now();
  private totalProxies = 0;
  
  constructor(config: Config) {
    this.config = config;
  }
  
  async run() {
    console.log('⚡ Ultra Fast Proxy Tester for Wagaya Japan');
    console.log('==========================================\n');
    
    // Load proxies
    const proxies = this.loadProxies();
    this.totalProxies = proxies.length;
    
    console.log(`📋 Testing ${proxies.length} proxies`);
    console.log(`⚡ Concurrency: ${this.config.concurrency} parallel tests`);
    console.log(`⏱️  Timeout: ${this.config.timeout}ms per proxy`);
    console.log(`🚀 Mode: ${this.config.quickMode ? 'Quick (basic test only)' : 'Full (test Wagaya access)'}\n`);
    
    // Start progress display
    const progressInterval = setInterval(() => this.showProgress(), 1000);
    
    // Process proxies in parallel
    await this.processProxies(proxies);
    
    clearInterval(progressInterval);
    this.showProgress(); // Final update
    console.log('\n');
    
    // Save results
    this.saveResults();
  }
  
  private loadProxies(): string[] {
    const content = fs.readFileSync(this.config.inputFile, 'utf-8');
    return [...new Set(
      content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes(':'))
    )];
  }
  
  private async processProxies(proxies: string[]) {
    const queue = [...proxies];
    const workers: Promise<void>[] = [];
    
    // Create workers up to concurrency limit
    for (let i = 0; i < Math.min(this.config.concurrency, proxies.length); i++) {
      workers.push(this.worker(queue));
    }
    
    await Promise.all(workers);
  }
  
  private async worker(queue: string[]) {
    while (queue.length > 0) {
      const proxy = queue.shift();
      if (!proxy) break;
      
      const isWorking = await this.testProxy(proxy);
      
      if (isWorking) {
        this.workingProxies.add(proxy);
        
        // Save progress periodically
        if (this.workingProxies.size % this.config.saveInterval === 0) {
          this.saveProgress();
        }
      }
      
      this.tested++;
    }
  }
  
  private async testProxy(proxy: string): Promise<boolean> {
    const [host, port] = proxy.split(':');
    const proxyConfig = {
      host,
      port: parseInt(port),
      protocol: 'http' as const
    };
    
    try {
      if (this.config.quickMode) {
        // Quick mode: just test basic connectivity
        const response = await axios.get('http://httpbin.org/ip', {
          timeout: Math.min(3000, this.config.timeout),
          proxy: proxyConfig,
          validateStatus: () => true
        });
        return response.status === 200;
      } else {
        // Full mode: test Wagaya access
        const response = await axios.get(
          'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
          {
            timeout: this.config.timeout,
            proxy: proxyConfig,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            maxRedirects: 5,
            validateStatus: (status) => status < 500,
          }
        );
        
        return response.status === 200 && response.data.includes('wagaya');
      }
    } catch {
      return false;
    }
  }
  
  private showProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = Math.round(this.tested / elapsed);
    const eta = this.tested > 0 ? Math.round((this.totalProxies - this.tested) / rate) : 0;
    const percentage = ((this.tested / this.totalProxies) * 100).toFixed(1);
    
    process.stdout.write(
      `\r[${this.tested}/${this.totalProxies}] ${percentage}% | ` +
      `✅ ${this.workingProxies.size} working | ` +
      `⚡ ${rate}/s | ` +
      `⏱️  ETA: ${this.formatTime(eta)}` +
      '     '
    );
  }
  
  private formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
  
  private saveProgress() {
    if (this.workingProxies.size === 0) return;
    
    const progressFile = this.config.inputFile.replace('.txt', '-progress.txt');
    const content = [
      `# Working proxies - Progress`,
      `# Tested: ${this.tested}/${this.totalProxies}`,
      `# Working: ${this.workingProxies.size}`,
      `# Updated: ${new Date().toISOString()}`,
      '',
      ...Array.from(this.workingProxies)
    ].join('\n');
    
    fs.writeFileSync(progressFile, content);
  }
  
  private saveResults() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const successRate = ((this.workingProxies.size / this.totalProxies) * 100).toFixed(2);
    
    console.log('📊 Final Results:');
    console.log('================');
    console.log(`Total tested: ${this.totalProxies}`);
    console.log(`✅ Working: ${this.workingProxies.size} (${successRate}%)`);
    console.log(`❌ Failed: ${this.totalProxies - this.workingProxies.size}`);
    console.log(`⏱️  Total time: ${elapsed.toFixed(1)}s`);
    console.log(`⚡ Average rate: ${Math.round(this.totalProxies / elapsed)} proxies/s`);
    
    if (this.workingProxies.size > 0) {
      // Save working proxies
      const outputFile = this.config.inputFile.replace('.txt', '-working.txt');
      const content = [
        '# Working proxies for Wagaya Japan',
        `# Tested: ${new Date().toISOString()}`,
        `# Mode: ${this.config.quickMode ? 'Quick' : 'Full'}`,
        `# Found: ${this.workingProxies.size}/${this.totalProxies} (${successRate}%)`,
        `# Test duration: ${elapsed.toFixed(1)}s`,
        '',
        ...Array.from(this.workingProxies)
      ].join('\n');
      
      fs.writeFileSync(outputFile, content);
      console.log(`\n💾 Saved ${this.workingProxies.size} working proxies to: ${outputFile}`);
      
      // Update main proxy list if we have enough good ones
      if (this.workingProxies.size >= 10 && !this.config.quickMode) {
        const mainFile = path.join(path.dirname(this.config.inputFile), 'proxilist.txt');
        const mainContent = [
          '# Working proxies for Wagaya Japan',
          `# Last verified: ${new Date().toISOString().split('T')[0]}`,
          '# These proxies have been tested and confirmed to work',
          '',
          ...Array.from(this.workingProxies).slice(0, 50)
        ].join('\n');
        
        fs.writeFileSync(mainFile, mainContent);
        console.log(`💾 Updated main proxy list with top ${Math.min(this.workingProxies.size, 50)} proxies`);
      }
    }
  }
}

// Main
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log('Usage: npx tsx scripts/ultra-fast-proxy-test.ts <input-file> [options]');
    console.log('\nOptions:');
    console.log('  --concurrency <n>  Number of parallel tests (default: 100)');
    console.log('  --timeout <ms>     Timeout per proxy in ms (default: 8000)');
    console.log('  --quick            Quick mode - test basic connectivity only');
    console.log('  --save-interval <n> Save progress every n working proxies (default: 10)');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/ultra-fast-proxy-test.ts proxies.txt');
    console.log('  npx tsx scripts/ultra-fast-proxy-test.ts proxies.txt --concurrency 200 --quick');
    console.log('  npx tsx scripts/ultra-fast-proxy-test.ts big-list.txt --concurrency 500 --timeout 5000');
    process.exit(0);
  }
  
  const config: Config = {
    inputFile: args[0],
    concurrency: 100,
    timeout: 8000,
    quickMode: false,
    saveInterval: 10
  };
  
  // Parse options
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--concurrency':
        config.concurrency = parseInt(args[++i]) || 100;
        break;
      case '--timeout':
        config.timeout = parseInt(args[++i]) || 8000;
        break;
      case '--quick':
        config.quickMode = true;
        break;
      case '--save-interval':
        config.saveInterval = parseInt(args[++i]) || 10;
        break;
    }
  }
  
  // Validate
  if (!fs.existsSync(config.inputFile)) {
    console.error(`❌ File not found: ${config.inputFile}`);
    process.exit(1);
  }
  
  const tester = new UltraFastProxyTester(config);
  tester.run().catch(console.error);
}

main();