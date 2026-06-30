import type { Aggregates, EntryDocument, ThemeId } from "../types/api";
import { formatEmotion, pct, sumValues } from "./formatters";

export function getInsightTitle(theme: ThemeId): string {
  const titles: Record<ThemeId, string> = {
    finegrained: "Fine-grained Polarity",
    aspect: "Aspect-Based Sentiment",
    emotion: "Emotion Detection",
    intent: "Intent Classification",
    sarcasm: "Sarcasm Detection",
    keywords: "Keyword Scoring",
    topics: "Topic Modelling",
    trend: "Temporal Trend",
    confidence: "Confidence Scoring",
  };
  return titles[theme];
}

export function generateInsight(
  theme: ThemeId,
  aggregates: Aggregates,
  entries: EntryDocument[],
  totalEntries: number,
): string {
  switch (theme) {
    case "finegrained": {
      const dist = aggregates.polarity_distribution;
      const total = sumValues(dist) || totalEntries || 1;
      const pos =
        (dist["Very Positive"] ?? 0) + (dist["Positive"] ?? 0);
      const neg = (dist["Negative"] ?? 0) + (dist["Very Negative"] ?? 0);
      const neu = dist["Neutral"] ?? 0;
      const posPct = pct(pos, total);
      const negPct = pct(neg, total);
      const neuPct = pct(neu, total);
      const tone =
        posPct >= 50
          ? "predominantly positive"
          : negPct >= 40
            ? "skewing negative"
            : "mixed";
      return `The dataset is ${tone} with ${posPct}% of entries classified as Positive or Very Positive. The negative segment (${negPct}%) and neutral entries (${neuPct}%) help contextualize overall tone across the dataset.`;
    }
    case "aspect": {
      const terms = new Set<string>();
      entries.forEach((e) => e.aspects?.forEach((a) => terms.add(a.term)));
      return `${terms.size || "Several"} aspects were detected across entries. Review the sentiment breakdown table to see which topics drive positive or negative opinion in this dataset.`;
    }
    case "emotion": {
      const emo = aggregates.emotion_distribution;
      if (Object.keys(emo).length === 0) return "Emotion data is not available — R pipeline was not reachable when this analysis ran.";
      const top = Object.entries(emo).sort((a, b) => b[1] - a[1])[0];
      const topLabel = top ? formatEmotion(top[0]) : "Joy";
      const topPct = top ? Math.round(top[1] * 100) : 0;
      return `${topLabel} dominates at ${topPct}%, reflecting the primary emotional register of the dataset. Secondary emotions provide nuance beyond simple polarity labels.`;
    }
    case "intent": {
      const dist = aggregates.intent_distribution;
      const complaints = dist.complaint ?? 0;
      const suggestions = dist.suggestion ?? 0;
      const compliments = dist.compliment ?? 0;
      const inquiries = dist.inquiry ?? 0;
      return `${complaints} complaints, ${suggestions} suggestions, ${compliments} compliments, and ${inquiries} inquiries were identified. Use intent filters to prioritise entries that require action.`;
    }
    case "sarcasm": {
      const count = aggregates.sarcasm_count;
      const pctVal = pct(count, totalEntries || 1);
      return `${count} entries (${pctVal}%) are flagged as likely sarcastic. Excluding these from aggregate calculations can improve accuracy of overall sentiment scores.`;
    }
    case "keywords": {
      if (aggregates.keywords_positive.length === 0 && aggregates.keywords_negative.length === 0)
        return "Keyword data is not available — R pipeline was not reachable when this analysis ran.";
      const pos = aggregates.keywords_positive[0]?.word ?? "—";
      const neg = aggregates.keywords_negative[0]?.word ?? "—";
      return `"${pos}" leads positive-driving terms while "${neg}" appears among the strongest negative signals. Keyword scores reflect model contribution, not raw frequency alone.`;
    }
    case "topics": {
      const n = aggregates.topics.length;
      if (n === 0) return "Topic data is not available — R pipeline was not reachable when this analysis ran.";
      return `${n} recurring themes were identified. Each topic includes a sentiment profile to show how people feel about that theme specifically.`;
    }
    case "trend": {
      const trend = aggregates.temporal_trend;
      if (!trend.length) return "No timestamp column was configured, so temporal trend analysis is unavailable for this dataset.";
      const first = trend[0].avg_polarity;
      const last = trend[trend.length - 1].avg_polarity;
      const direction = last > first ? "improving" : last < first ? "declining" : "stable";
      return `Sentiment appears ${direction} from ${trend[0].period} to ${trend[trend.length - 1].period}. Inspect the chart for spikes or turning points across the timeline.`;
    }
    case "confidence": {
      const avg =
        entries.reduce((s, e) => s + e.polarity_confidence, 0) /
        (entries.length || 1);
      const low = entries.filter((e) => e.polarity_confidence < 0.6).length;
      return `Average model confidence is ${Math.round(avg * 100)}%. ${low} entries score below 60% and may warrant manual review before drawing conclusions.`;
    }
    default:
      return "";
  }
}
