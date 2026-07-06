import { AiInsightBox } from "../AiInsightBox";
import { BarRow } from "../shared/BarRow";
import { SummaryPills } from "../shared/SummaryPills";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { formatIntent, polarityBadgeClass, truncate } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

const INTENT_CONFIG: { key: string; cls: string; color: string }[] = [
  { key: "complaint",  cls: "bar-neg",  color: "#dc2626" },
  { key: "inquiry",   cls: "bar-neu",  color: "#6366f1" },
  { key: "compliment", cls: "bar-pos",  color: "#16a34a" },
  { key: "suggestion", cls: "bar-surp", color: "#d97706" },
  { key: "statement",  cls: "bar-vpos", color: "#555"    },
];

export function IntentPanel({ aggregates, entries, totalEntries }: Props) {
  const dist = aggregates.intent_distribution ?? {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const hasData = total > 0;

  const topIntent = hasData
    ? Object.entries(dist).sort((a, b) => b[1] - a[1])[0]
    : null;

  const entriesWithIntent = entries.filter((e) => e.intent && e.intent !== "");

  if (!hasData && entriesWithIntent.length === 0) {
    return (
      <div className="panel-notice panel-notice--unavailable">
        <div className="panel-notice__icon">ℹ️</div>
        <div className="panel-notice__body">
          <strong>No intent data available</strong>
          <p>Intent classification was not returned by the ML model for this dataset.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AiInsightBox theme="intent" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <SummaryPills
        items={[
          { label: "entries with intent", value: total || entriesWithIntent.length },
          { label: "top intent", value: topIntent ? formatIntent(topIntent[0]) : "—" },
          { label: "distinct intents", value: Object.keys(dist).length },
        ]}
      />
      {hasData && (
        <div className="two-col">
          <div className="card">
            <h3>Intent Distribution</h3>
            {INTENT_CONFIG.filter(({ key }) => dist[key] !== undefined).map(({ key, cls }) => (
              <BarRow
                key={key}
                label={formatIntent(key)}
                pct={total > 0 ? Math.round((dist[key] / total) * 100) : 0}
                fillClass={cls}
              />
            ))}
            {Object.keys(dist)
              .filter((k) => !INTENT_CONFIG.find((c) => c.key === k))
              .map((key) => (
                <BarRow
                  key={key}
                  label={formatIntent(key)}
                  pct={total > 0 ? Math.round((dist[key] / total) * 100) : 0}
                  fillClass="bar-neu"
                />
              ))}
          </div>
          <div className="card">
            <h3>Count Breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(dist)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                  const cfg = INTENT_CONFIG.find((c) => c.key === key);
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        className="badge"
                        style={{ background: cfg?.color ?? "#555", color: "#fff", minWidth: 80, textAlign: "center" }}
                      >
                        {formatIntent(key)}
                      </span>
                      <span style={{ fontWeight: "bold", fontSize: 14 }}>{count}</span>
                      <span style={{ color: "#888", fontSize: 11 }}>
                        ({total > 0 ? Math.round((count / total) * 100) : 0}%)
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      {entriesWithIntent.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Entry Breakdown</h3>
          <table className="conf-table">
            <thead>
              <tr>
                <th>Text</th>
                <th>Intent</th>
                <th>Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {entriesWithIntent.slice(0, 30).map((entry) => (
                <tr key={entry.row_index}>
                  <td style={{ color: "#555", maxWidth: 220 }}>"{truncate(entry.original_text, 60)}"</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: INTENT_CONFIG.find((c) => c.key === entry.intent)?.color ?? "#888",
                        color: "#fff",
                      }}
                    >
                      {formatIntent(entry.intent)}
                    </span>
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
