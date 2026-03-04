'use client';

import type { Insight } from '@/types';

interface InsightsPanelProps {
  insight: Insight;
}

export function InsightsPanel({ insight }: InsightsPanelProps) {
  return (
    <div className="rounded-xl border border-brand-500/20 bg-brand-50 p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-700">
        AI Insights
      </h3>
      <div className="space-y-4">
        <InsightBlock title="Content Patterns" body={insight.contentPatterns} />
        <InsightBlock title="Primary Sell Focus" body={insight.primarySellFocus} />
        <InsightBlock title="Audience Profile" body={insight.audienceProfile} />
      </div>
      <p className="mt-4 text-right text-xs text-gray-400">
        Generated {new Date(insight.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

function InsightBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-brand-800">{title}</p>
      <p className="text-sm leading-relaxed text-gray-700">{body}</p>
    </div>
  );
}
