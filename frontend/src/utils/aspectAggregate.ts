import type { EntryDocument } from "../types/api";

export interface AspectRow {
  term: string;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  scorePct: number;
  keywords: string;
}

export function aggregateAspects(entries: EntryDocument[]): AspectRow[] {
  const map = new Map<
    string,
    { pos: number; neu: number; neg: number; scores: number[]; count: number }
  >();

  for (const entry of entries) {
    for (const aspect of entry.aspects ?? []) {
      const current = map.get(aspect.term) ?? {
        pos: 0,
        neu: 0,
        neg: 0,
        scores: [],
        count: 0,
      };
      current.count += 1;
      current.scores.push(aspect.score);
      const s = aspect.sentiment.toLowerCase();
      if (s.includes("positive")) current.pos += 1;
      else if (s.includes("negative")) current.neg += 1;
      else current.neu += 1;
      map.set(aspect.term, current);
    }
  }

  return Array.from(map.entries())
    .map(([term, data]) => {
      const total = data.count || 1;
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      return {
        term,
        positivePct: Math.round((data.pos / total) * 100),
        neutralPct: Math.round((data.neu / total) * 100),
        negativePct: Math.round((data.neg / total) * 100),
        scorePct: Math.round(((avgScore + 1) / 2) * 100),
        keywords: term,
      };
    })
    .sort((a, b) => b.scorePct - a.scorePct);
}
