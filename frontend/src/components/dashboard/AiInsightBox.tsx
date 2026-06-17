import { generateInsight, getInsightTitle } from "../../utils/insights";
import type { Aggregates, EntryDocument, ThemeId } from "../../types/api";

interface AiInsightBoxProps {
  theme: ThemeId;
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

export function AiInsightBox({ theme, aggregates, entries, totalEntries }: AiInsightBoxProps) {
  const title = getInsightTitle(theme);
  const text = generateInsight(theme, aggregates, entries, totalEntries);
  return (
    <div className="ai-box">
      <div className="ai-icon">🤖</div>
      <div className="ai-text">
        <strong>AI Insight — {title}</strong>
        <br />
        {text}
      </div>
    </div>
  );
}
