import type { CSSProperties } from "react";
import { AiInsightBox } from "../AiInsightBox";
import { SummaryPills } from "../shared/SummaryPills";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { polarityBadgeClass, truncate } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

function sentimentColor(sentiment: string): string {
  if (sentiment === "positive") return "#16a34a";
  if (sentiment === "negative") return "#dc2626";
  return "#888";
}

function sentimentBadgeStyle(sentiment: string): CSSProperties {
  return {
    background: sentimentColor(sentiment),
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "bold",
    display: "inline-block",
  };
}

export function AspectPanel({ aggregates, entries, totalEntries }: Props) {
  const aspectAgg = aggregates.aspect_sentiment ?? [];
  const entriesWithAspects = entries.filter((e) => e.aspects && e.aspects.length > 0);
  const hasData = aspectAgg.length > 0 || entriesWithAspects.length > 0;

  if (!hasData) {
    return (
      <div className="panel-notice panel-notice--unavailable">
        <div className="panel-notice__icon">ℹ️</div>
        <div className="panel-notice__body">
          <strong>No aspect data available</strong>
          <p>Aspect-based sentiment was not returned by the ML model for this dataset.</p>
        </div>
      </div>
    );
  }

  const totalMentions = aspectAgg.reduce((s, a) => s + a.total, 0);

  return (
    <>
      <AiInsightBox theme="aspect" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <SummaryPills
        items={[
          { label: "unique aspects detected", value: aspectAgg.length },
          { label: "total aspect mentions", value: totalMentions },
          { label: "entries with aspects", value: entriesWithAspects.length },
        ]}
      />

      {aspectAgg.length > 0 && (
        <div className="two-col">
          <div className="card">
            <h3>Top Aspects by Mentions</h3>
            {aspectAgg.slice(0, 12).map((asp) => {
              const posW = asp.total > 0 ? (asp.positive / asp.total) * 100 : 0;
              const negW = asp.total > 0 ? (asp.negative / asp.total) * 100 : 0;
              const neuW = asp.total > 0 ? (asp.neutral / asp.total) * 100 : 0;
              return (
                <div key={asp.term} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontWeight: "bold", textTransform: "capitalize" }}>{asp.term}</span>
                    <span style={{ color: "#888", fontSize: 11 }}>{asp.total} mentions</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: 10,
                      borderRadius: 5,
                      overflow: "hidden",
                      background: "#eee",
                    }}
                  >
                    {posW > 0 && (
                      <div style={{ width: `${posW}%`, background: "#16a34a" }} title={`Positive: ${asp.positive}`} />
                    )}
                    {neuW > 0 && (
                      <div style={{ width: `${neuW}%`, background: "#bbb" }} title={`Neutral: ${asp.neutral}`} />
                    )}
                    {negW > 0 && (
                      <div style={{ width: `${negW}%`, background: "#dc2626" }} title={`Negative: ${asp.negative}`} />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 10, color: "#888" }}>
                    <span style={{ color: "#16a34a" }}>+{asp.positive}</span>
                    <span>~{asp.neutral}</span>
                    <span style={{ color: "#dc2626" }}>−{asp.negative}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card">
            <h3>Aspect Sentiment Overview</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aspectAgg.slice(0, 12).map((asp) => {
                const dominant =
                  asp.positive >= asp.negative && asp.positive >= asp.neutral
                    ? "positive"
                    : asp.negative >= asp.positive && asp.negative >= asp.neutral
                      ? "negative"
                      : "neutral";
                return (
                  <div
                    key={asp.term}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        fontWeight: "bold",
                        textTransform: "capitalize",
                        minWidth: 80,
                        fontSize: 12,
                      }}
                    >
                      {asp.term}
                    </span>
                    <span style={sentimentBadgeStyle(dominant)}>
                      {dominant.charAt(0).toUpperCase() + dominant.slice(1)}
                    </span>
                    <span style={{ fontSize: 11, color: "#aaa" }}>
                      {asp.total} mention{asp.total !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {entriesWithAspects.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Entry Aspect Detail</h3>
          <table className="conf-table">
            <thead>
              <tr>
                <th>Text</th>
                <th>Aspects Detected</th>
                <th>Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {entriesWithAspects.slice(0, 30).map((entry) => (
                <tr key={entry.row_index}>
                  <td style={{ color: "#555", maxWidth: 200 }}>"{truncate(entry.original_text, 55)}"</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {entry.aspects.map((asp) => (
                        <span
                          key={asp.term}
                          style={{
                            ...sentimentBadgeStyle(asp.sentiment),
                            textTransform: "capitalize",
                          }}
                        >
                          {asp.term}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={polarityBadgeClass(entry.polarity)}>{entry.polarity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
