import { AiInsightBox } from "../AiInsightBox";
import { BarRow } from "../shared/BarRow";
import { DonutChart } from "../shared/DonutChart";
import { SummaryPills } from "../shared/SummaryPills";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { pct, sumValues } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

const POLARITY_ORDER = [
  { key: "Very Positive", cls: "bar-vpos" },
  { key: "Positive", cls: "bar-pos" },
  { key: "Neutral", cls: "bar-neu" },
  { key: "Negative", cls: "bar-neg" },
  { key: "Very Negative", cls: "bar-vneg" },
];

export function FineGrainedPanel({ aggregates, entries, totalEntries }: Props) {
  const dist = aggregates.polarity_distribution;
  const total = sumValues(dist) || totalEntries || 1;
  const pos = (dist["Very Positive"] ?? 0) + (dist["Positive"] ?? 0);
  const neg = (dist["Negative"] ?? 0) + (dist["Very Negative"] ?? 0);
  const neu = dist["Neutral"] ?? 0;

  return (
    <>
      <AiInsightBox theme="finegrained" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <SummaryPills
        items={[
          { label: "total entries", value: totalEntries },
          { label: "positive or above", value: `${pct(pos, total)}%` },
          { label: "negative or below", value: `${pct(neg, total)}%` },
          { label: "neutral", value: `${pct(neu, total)}%` },
        ]}
      />
      <div className="two-col">
        <div className="card">
          <h3>Polarity Distribution</h3>
          {POLARITY_ORDER.map(({ key, cls }) => (
            <BarRow key={key} label={key} pct={pct(dist[key] ?? 0, total)} fillClass={cls} />
          ))}
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h3>Overall Distribution</h3>
          <DonutChart distribution={dist} />
        </div>
      </div>
    </>
  );
}
