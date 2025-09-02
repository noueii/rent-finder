import { getJobQueue } from '../src/lib/jobs/queue';

async function checkJobQueue() {
  const queue = getJobQueue();
  const stats = queue.getStats();
  const jobs = queue.getAllJobs();
  
  console.log('\n=== Job Queue Status ===');
  console.log('Total jobs:', stats.total);
  console.log('Pending:', stats.pending);
  console.log('Processing:', stats.processing);
  console.log('Completed:', stats.completed);
  console.log('Failed:', stats.failed);
  
  console.log('\n=== Recent Jobs ===');
  jobs.slice(0, 10).forEach(job => {
    console.log(`\n[${job.id}]`);
    console.log(`  Type: ${job.type}`);
    console.log(`  Scraper: ${job.data?.scraperType || 'N/A'}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Progress: ${job.progress}%`);
    if (job.data?.urls?.length) {
      console.log(`  URLs: ${job.data.urls.length}`);
    }
    if (job.error) {
      console.log(`  Error: ${job.error}`);
    }
    console.log(`  Created: ${job.createdAt.toISOString()}`);
    if (job.startedAt) {
      console.log(`  Started: ${job.startedAt.toISOString()}`);
    }
    if (job.completedAt) {
      console.log(`  Completed: ${job.completedAt.toISOString()}`);
    }
  });
  
  // Check for stuck jobs
  const processingJobs = jobs.filter(j => j.status === 'processing');
  if (processingJobs.length > 0) {
    console.log('\n=== Currently Processing ===');
    processingJobs.forEach(job => {
      console.log(`- ${job.data?.scraperType || job.type} (${job.id})`);
    });
  }
  
  // Check scraper availability
  const scraperTypes = ['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences'];
  console.log('\n=== Scraper Availability ===');
  scraperTypes.forEach(type => {
    const isRunning = queue.isScraperRunning(type);
    console.log(`${type}: ${isRunning ? '🔴 BUSY' : '🟢 AVAILABLE'}`);
  });
}

checkJobQueue().catch(console.error);