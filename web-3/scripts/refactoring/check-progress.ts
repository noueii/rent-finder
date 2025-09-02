#!/usr/bin/env ts-node

/**
 * Check refactoring progress and report status
 * Usage: npm run refactor:progress
 */

import * as fs from 'fs';
import * as path from 'path';

interface Task {
  id: string;
  name: string;
  status: '⬜' | '⏳' | '✅' | '⚠️';
  agent: string;
}

interface AgentProgress {
  agent: string;
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  percentage: number;
}

// Parse progress file
function parseProgressFile(): Task[] {
  const progressPath = path.join(__dirname, '../../docs/refactoring/REFACTOR-PROGRESS.md');
  const content = fs.readFileSync(progressPath, 'utf-8');
  
  const tasks: Task[] = [];
  const taskRegex = /- \[([ x])\] (.+) ([⬜⏳✅⚠️])/g;
  const agentRegex = /### (\w+) (?:\(.*?\))? -/;
  
  let currentAgent = '';
  const lines = content.split('\n');
  
  for (const line of lines) {
    const agentMatch = line.match(agentRegex);
    if (agentMatch) {
      currentAgent = agentMatch[1];
    }
    
    const taskMatch = line.matchAll(taskRegex);
    for (const match of taskMatch) {
      tasks.push({
        id: `${currentAgent}-${tasks.length + 1}`,
        name: match[2].trim(),
        status: match[3] as Task['status'],
        agent: currentAgent,
      });
    }
  }
  
  return tasks;
}

// Calculate progress by agent
function calculateProgress(tasks: Task[]): AgentProgress[] {
  const agentMap = new Map<string, AgentProgress>();
  
  for (const task of tasks) {
    if (!agentMap.has(task.agent)) {
      agentMap.set(task.agent, {
        agent: task.agent,
        total: 0,
        completed: 0,
        inProgress: 0,
        blocked: 0,
        percentage: 0,
      });
    }
    
    const progress = agentMap.get(task.agent)!;
    progress.total++;
    
    switch (task.status) {
      case '✅':
        progress.completed++;
        break;
      case '⏳':
        progress.inProgress++;
        break;
      case '⚠️':
        progress.blocked++;
        break;
    }
  }
  
  // Calculate percentages
  for (const progress of agentMap.values()) {
    progress.percentage = Math.round((progress.completed / progress.total) * 100);
  }
  
  return Array.from(agentMap.values());
}

// Generate progress report
function generateReport(tasks: Task[], progress: AgentProgress[]): void {
  console.log('🔧 REFACTORING PROGRESS REPORT');
  console.log('============================\n');
  
  // Overall stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === '✅').length;
  const inProgressTasks = tasks.filter(t => t.status === '⏳').length;
  const blockedTasks = tasks.filter(t => t.status === '⚠️').length;
  const overallPercentage = Math.round((completedTasks / totalTasks) * 100);
  
  console.log(`📊 Overall Progress: ${overallPercentage}%`);
  console.log(`✅ Completed: ${completedTasks}/${totalTasks}`);
  console.log(`⏳ In Progress: ${inProgressTasks}`);
  console.log(`⚠️  Blocked: ${blockedTasks}`);
  console.log(`⬜ Not Started: ${totalTasks - completedTasks - inProgressTasks - blockedTasks}\n`);
  
  // Progress bar
  const barLength = 50;
  const filledLength = Math.round((overallPercentage / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(`[${bar}] ${overallPercentage}%\n`);
  
  // Agent breakdown
  console.log('📋 Progress by Agent:');
  console.log('--------------------');
  
  for (const p of progress.sort((a, b) => b.percentage - a.percentage)) {
    const agentBar = '▓'.repeat(Math.round(p.percentage / 10)) + '░'.repeat(10 - Math.round(p.percentage / 10));
    console.log(`${p.agent.padEnd(3)} [${agentBar}] ${p.percentage.toString().padStart(3)}% - ${p.completed}/${p.total} tasks`);
    
    if (p.blocked > 0) {
      console.log(`    ⚠️  ${p.blocked} blocked task(s)`);
    }
    if (p.inProgress > 0) {
      console.log(`    ⏳ ${p.inProgress} in progress`);
    }
  }
  
  // Critical path status
  console.log('\n🚨 Critical Path Status:');
  const criticalTasks = [
    { id: 'DO-004', name: 'DI Container' },
    { id: 'BE-003', name: 'Service Layer' },
    { id: 'FE-001', name: 'Split ApartmentCard' },
  ];
  
  for (const critical of criticalTasks) {
    const task = tasks.find(t => t.name.includes(critical.name));
    if (task) {
      const status = task.status === '✅' ? '✅ Complete' : 
                    task.status === '⏳' ? '⏳ In Progress' :
                    task.status === '⚠️' ? '⚠️  BLOCKED' : '⬜ Not Started';
      console.log(`- ${critical.name}: ${status}`);
    }
  }
  
  // Blockers
  const blockedTasksList = tasks.filter(t => t.status === '⚠️');
  if (blockedTasksList.length > 0) {
    console.log('\n⚠️  Current Blockers:');
    for (const task of blockedTasksList) {
      console.log(`- [${task.agent}] ${task.name}`);
    }
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  // Find agents with no work
  const idleAgents = progress.filter(p => p.inProgress === 0 && p.completed < p.total);
  if (idleAgents.length > 0) {
    console.log(`- Agents ready to start work: ${idleAgents.map(a => a.agent).join(', ')}`);
  }
  
  // Check critical path
  const doProgress = progress.find(p => p.agent === 'DO');
  if (doProgress && doProgress.percentage < 50) {
    console.log('- ⚠️  DO is on critical path and needs priority attention');
  }
  
  // Check for high blocker count
  if (blockedTasks > 2) {
    console.log('- ⚠️  High number of blockers - coordination needed');
  }
  
  console.log('\n✨ Run `npm run refactor:report` for detailed analysis');
}

// Main execution
function main(): void {
  try {
    const tasks = parseProgressFile();
    const progress = calculateProgress(tasks);
    generateReport(tasks, progress);
  } catch (error) {
    console.error('❌ Error reading progress file:', error);
    process.exit(1);
  }
}

main();