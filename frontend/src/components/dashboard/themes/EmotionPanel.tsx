import { AiInsightBox } from "../AiInsightBox";
import { BarRow } from "../shared/BarRow";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { formatEmotion } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

const EMO_CONFIG = [
  { key: "happiness", label: "Joy", cls: "bar-joy", emoji: "😊", bg: "#fef9c3" },
  { key: "sadness", label: "Sadness", cls: "bar-sad", emoji: "😢", bg: "#dbeafe" },
  { key: "anger", label: "Anger", cls: "bar-ang", emoji: "😠", bg: "#fee2e2" },
  { key: "surprise", label: "Surprise", cls: "bar-surp", emoji: "😲", bg: "#d1fae5" },
  { key: "fear", label: "Fear", cls: "bar-fear", emoji: "😨", bg: "#ede9fe" },
  { key: "disgust", label: "Disgust", cls: "bar-disg", emoji: "🤢", bg: "#ffedd5" },
];

export function EmotionPanel({ aggregates, entries, totalEntries }: Props) {
  const emo = aggregates.emotion_distribution;

  return (
    <>
      <AiInsightBox theme="emotion" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="two-col">
        <div className="card">
          <h3>Emotion Distribution</h3>
          {EMO_CONFIG.map(({ key, label, cls }) => (
            <BarRow key={key} label={label} pct={Math.round((emo[key] ?? 0) * 100)} fillClass={cls} />
          ))}
        </div>
        <div className="card">
          <h3>Emotion Overview</h3>
          <div className="emo-grid">
            {EMO_CONFIG.map(({ key, emoji, bg }) => (
              <div className="emo-cell" style={{ background: bg }} key={key}>
                <div className="emo-emoji">{emoji}</div>
                <div className="emo-label">{formatEmotion(key)}</div>
                <div className="emo-val">{Math.round((emo[key] ?? 0) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
