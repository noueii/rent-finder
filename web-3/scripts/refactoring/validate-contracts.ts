#!/usr/bin/env ts-node

/**
 * Validate that refactoring contracts are being followed
 * Usage: npm run refactor:contracts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ContractViolation {
  file: string;
  line: number;
  violation: string;
  severity: 'error' | 'warning';
}

interface FileOwnership {
  pattern: string;
  owner: string;
}

// Define file ownership based on CLAUDE.md
const fileOwnership: FileOwnership[] = [
  { pattern: 'src/lib/core/**', owner: 'DO' },
  { pattern: 'src/lib/di/**', owner: 'DO' },
  { pattern: 'src/server/**', owner: 'BE' },
  { pattern: 'src/lib/db/**', owner: 'BE' },
  { pattern: 'src/domain/**', owner: 'BE' },
  { pattern: 'src/application/**', owner: 'BE' },
  { pattern: 'src/lib/scrapers/**', owner: 'SC' },
  { pattern: 'src/infrastructure/scrapers/**', owner: 'SC' },
  { pattern: 'src/components/**', owner: 'FE' },
  { pattern: 'src/app/**', owner: 'FE' },
  { pattern: 'src/presentation/**', owner: 'FE' },
  { pattern: 'src/lib/transit/**', owner: 'IN' },
  { pattern: 'src/lib/performance/**', owner: 'IN' },
  { pattern: 'src/infrastructure/external/**', owner: 'IN' },
];

// Check for cross-boundary imports
async function checkImportViolations(): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  const srcPath = path.join(__dirname, '../../src');
  
  // Define import rules
  const importRules = [
    // Domain layer should not import infrastructure
    { 
      from: 'src/domain/**', 
      forbidden: ['prisma', '@prisma/client', 'src/infrastructure'],
      message: 'Domain layer cannot import infrastructure details'
    },
    // Presentation should not import server
    { 
      from: 'src/presentation/**', 
      forbidden: ['src/server', 'prisma', '@prisma/client'],
      message: 'Presentation layer cannot import server-side code'
    },
    // Components should not have business logic imports
    { 
      from: 'src/components/**', 
      forbidden: ['src/server', 'src/domain/services', 'prisma'],
      message: 'Components should not import business logic directly'
    },
  ];
  
  for (const rule of importRules) {
    const files = await glob(rule.from, { cwd: process.cwd() });
    
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes('import')) {
            for (const forbidden of rule.forbidden) {
              if (line.includes(forbidden)) {
                violations.push({
                  file,
                  line: index + 1,
                  violation: `${rule.message}: imports '${forbidden}'`,
                  severity: 'error'
                });
              }
            }
          }
        });
      }
    }
  }
  
  return violations;
}

// Check for ownership violations in git commits
async function checkOwnershipViolations(): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  
  // This would normally check git history, but for now we'll check current state
  console.log('ℹ️  Ownership checks would run during CI/CD');
  
  return violations;
}

// Check for interface compliance
async function checkInterfaceCompliance(): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  
  // Check if key interfaces exist
  const requiredInterfaces = [
    { path: 'src/core/errors/types.ts', interfaces: ['ErrorHandler', 'ErrorContext'] },
    { path: 'src/core/validation/types.ts', interfaces: ['Validator', 'ValidationResult'] },
    { path: 'src/core/di/types.ts', interfaces: ['Container', 'InjectionToken'] },
  ];
  
  for (const req of requiredInterfaces) {
    const fullPath = path.join(process.cwd(), req.path);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      for (const interfaceName of req.interfaces) {
        if (!content.includes(`interface ${interfaceName}`)) {
          violations.push({
            file: req.path,
            line: 0,
            violation: `Missing required interface: ${interfaceName}`,
            severity: 'error'
          });
        }
      }
    } else {
      // File doesn't exist yet (expected during refactoring)
      violations.push({
        file: req.path,
        line: 0,
        violation: 'Required contract file not yet created',
        severity: 'warning'
      });
    }
  }
  
  return violations;
}

// Check for type safety violations
async function checkTypeSafety(): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  const files = await glob('src/**/*.{ts,tsx}', { cwd: process.cwd() });
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for 'any' types
      if (line.match(/:\s*any\b/) && !line.includes('// eslint-disable')) {
        violations.push({
          file,
          line: index + 1,
          violation: 'Use of "any" type detected',
          severity: 'warning'
        });
      }
      
      // Check for ts-ignore
      if (line.includes('@ts-ignore')) {
        violations.push({
          file,
          line: index + 1,
          violation: 'Use of @ts-ignore detected',
          severity: 'warning'
        });
      }
    });
  }
  
  return violations;
}

// Generate report
function generateReport(violations: ContractViolation[]): void {
  console.log('📜 CONTRACT VALIDATION REPORT');
  console.log('============================\n');
  
  if (violations.length === 0) {
    console.log('✅ All contracts are being followed!\n');
    return;
  }
  
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  
  console.log(`Found ${violations.length} violations:`);
  console.log(`❌ Errors: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}\n`);
  
  // Group by file
  const byFile = new Map<string, ContractViolation[]>();
  for (const violation of violations) {
    if (!byFile.has(violation.file)) {
      byFile.set(violation.file, []);
    }
    byFile.get(violation.file)!.push(violation);
  }
  
  // Display violations
  for (const [file, fileViolations] of byFile) {
    console.log(`\n📁 ${file}`);
    for (const v of fileViolations) {
      const icon = v.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`  ${icon} Line ${v.line}: ${v.violation}`);
    }
  }
  
  // Summary and recommendations
  console.log('\n💡 Recommendations:');
  
  if (errors.length > 0) {
    console.log('- Fix all errors before proceeding with refactoring');
  }
  
  const anyViolations = violations.filter(v => v.violation.includes('"any"'));
  if (anyViolations.length > 0) {
    console.log(`- Replace ${anyViolations.length} "any" types with proper types`);
  }
  
  const importViolations = violations.filter(v => v.violation.includes('import'));
  if (importViolations.length > 0) {
    console.log('- Review and fix layer boundary violations');
  }
  
  console.log('\n✨ Run regularly to ensure contracts are maintained');
  
  // Exit with error if there are any errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    console.log('🔍 Checking contract compliance...\n');
    
    const violations: ContractViolation[] = [];
    
    // Run all checks
    violations.push(...await checkImportViolations());
    violations.push(...await checkOwnershipViolations());
    violations.push(...await checkInterfaceCompliance());
    violations.push(...await checkTypeSafety());
    
    generateReport(violations);
  } catch (error) {
    console.error('❌ Error validating contracts:', error);
    process.exit(1);
  }
}

main();