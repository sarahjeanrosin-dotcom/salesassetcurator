import 'dotenv/config';
import { createSearchWorker } from './search-job';

const worker = createSearchWorker();

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err);
});

console.log('[worker] Sales Asset Curator worker started');

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
