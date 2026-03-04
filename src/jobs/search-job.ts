import { runSearch } from '@/services/search-orchestrator';

export const SEARCH_QUEUE_NAME = 'search';

export interface SearchJobData {
  searchId: string;
}

export async function processSearchJob(data: SearchJobData): Promise<void> {
  await runSearch(data.searchId);
}
