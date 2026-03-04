import { prisma } from '@/lib/prisma';
import type { SearchConstraints } from '@/types';
import { fetchWebResults } from './web-fetcher';
import { fetchYouTubeResults } from './youtube-fetcher';
import { fetchTwitterResults } from './social/twitter-fetcher';
import { fetchLinkedInResults } from './social/linkedin-fetcher';
import { fetchInstagramResults } from './social/instagram-fetcher';
import { fetchFacebookResults } from './social/facebook-fetcher';
import { fetchRedditResults } from './social/reddit-fetcher';
import { classifyResults } from './classifier';
import { generateInsights } from './insight-generator';

export async function runSearch(searchId: string): Promise<void> {
  const search = await prisma.savedSearch.findUnique({ where: { id: searchId } });
  if (!search) throw new Error(`Search ${searchId} not found`);

  await prisma.savedSearch.update({
    where: { id: searchId },
    data: { status: 'RUNNING', lastRunAt: new Date() },
  });

  // Clear previous results so a refresh starts clean
  await prisma.salesAsset.deleteMany({ where: { searchId } });
  await prisma.insight.deleteMany({ where: { searchId } });

  try {
    const constraints = search.constraints as SearchConstraints;
    const excludePlatforms = new Set(constraints.excludePlatforms ?? []);

    // Run all enabled fetchers in parallel
    const fetcherResults = await Promise.allSettled([
      excludePlatforms.has('web') ? Promise.resolve([]) : fetchWebResults(search.companyName, constraints),
      excludePlatforms.has('youtube') ? Promise.resolve([]) : fetchYouTubeResults(search.companyName, constraints),
      excludePlatforms.has('twitter') ? Promise.resolve([]) : fetchTwitterResults(search.companyName, constraints),
      excludePlatforms.has('linkedin') ? Promise.resolve([]) : fetchLinkedInResults(search.companyName, constraints),
      excludePlatforms.has('instagram') ? Promise.resolve([]) : fetchInstagramResults(search.companyName, constraints),
      excludePlatforms.has('facebook') ? Promise.resolve([]) : fetchFacebookResults(search.companyName, constraints),
      excludePlatforms.has('reddit') ? Promise.resolve([]) : fetchRedditResults(search.companyName, constraints),
    ]);

    const allRaw = fetcherResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    // Filter by content type if requested
    // (classifier determines content type; we post-filter after classification)
    const classified = await classifyResults(allRaw);

    const filtered =
      constraints.contentTypes && constraints.contentTypes.length > 0
        ? classified.filter((a) => constraints.contentTypes!.includes(a.contentType))
        : classified;

    // Persist assets
    if (filtered.length > 0) {
      await prisma.salesAsset.createMany({
        data: filtered.map((a) => ({
          searchId,
          url: a.url,
          title: a.title,
          platform: a.platform,
          contentType: a.contentType,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
          views: a.views ?? null,
          impressions: a.impressions ?? null,
          comments: a.comments ?? null,
          likes: a.likes ?? null,
          shares: a.shares ?? null,
          summary: a.summary ?? null,
        })),
        skipDuplicates: true,
      });
    }

    // Generate insights from classified assets
    const insight = await generateInsights(filtered);
    await prisma.insight.create({
      data: {
        searchId,
        contentPatterns: insight.contentPatterns,
        primarySellFocus: insight.primarySellFocus,
        audienceProfile: insight.audienceProfile,
      },
    });

    await prisma.savedSearch.update({
      where: { id: searchId },
      data: { status: 'COMPLETED' },
    });
  } catch (err) {
    await prisma.savedSearch.update({
      where: { id: searchId },
      data: { status: 'FAILED' },
    });
    throw err;
  }
}
