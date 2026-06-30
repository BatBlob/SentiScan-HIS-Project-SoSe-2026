import { AiInsightBox } from "../AiInsightBox";
import { PanelRPipelineNotice } from "../PanelRPipelineNotice";
import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
  rPipelineError?: string | null;
}

export function TopicsPanel({ aggregates, entries, totalEntries, rPipelineError }: Props) {
  if (aggregates.topics.length === 0) {
    return (
      <PanelRPipelineNotice
        rPipelineError={rPipelineError}
        moduleName="Topic modelling"
      />
    );
  }

  return (
    <>
      <AiInsightBox theme="topics" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="three-col">
        {aggregates.topics.map((topic) => {
          const profile = topic.sentiment_profile;
          const pos = (profile.Positive ?? 0) + (profile["Very Positive"] ?? 0);
          const neg = (profile.Negative ?? 0) + (profile["Very Negative"] ?? 0);
          const neu = profile.Neutral ?? 0;
          const total = pos + neg + neu || 1;
          return (
            <div className="topic-card" key={topic.id}>
              <div className="topic-name">
                {String(topic.id).padStart(2, "0")} — {topic.label}
              </div>
              <div className="topic-kw">{topic.keywords.join(", ")}</div>
              <div className="topic-bar">
                <div style={{ flex: pos, background: "#22c55e" }} />
                <div style={{ flex: neu, background: "#d1d5db" }} />
                <div style={{ flex: neg, background: "#ef4444" }} />
              </div>
              <div className="topic-labels">
                <span>{Math.round((pos / total) * 100)}% pos</span>
                <span>{Math.round((neg / total) * 100)}% neg</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
