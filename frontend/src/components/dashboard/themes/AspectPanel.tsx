import { AiInsightBox } from "../AiInsightBox";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { aggregateAspects } from "../../../utils/aspectAggregate";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

export function AspectPanel({ aggregates, entries, totalEntries }: Props) {
  const rows = aggregateAspects(entries);

  return (
    <>
      <AiInsightBox theme="aspect" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="card">
        <h3>Sentiment by Aspect</h3>
        {rows.length === 0 ? (
          <p style={{ fontSize: 12, color: "#888" }}>No aspect data available for this dataset.</p>
        ) : (
          <table className="asp-table">
            <thead>
              <tr>
                <th>Aspect</th>
                <th>Sentiment breakdown</th>
                <th>Score</th>
                <th>Top keywords</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.term}>
                  <td style={{ fontWeight: "bold" }}>{row.term}</td>
                  <td>
                    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", width: 200 }}>
                      <div style={{ flex: row.positivePct, background: "#22c55e" }} />
                      <div style={{ flex: row.neutralPct, background: "#d1d5db" }} />
                      <div style={{ flex: row.negativePct, background: "#ef4444" }} />
                    </div>
                  </td>
                  <td style={{ color: row.scorePct >= 60 ? "#16a34a" : row.scorePct >= 40 ? "#ca8a04" : "#dc2626", fontWeight: "bold" }}>
                    {row.scorePct}%
                  </td>
                  <td style={{ fontSize: 11, color: "#777" }}>{row.keywords}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
