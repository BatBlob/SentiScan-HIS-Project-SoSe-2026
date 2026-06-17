export const THEMES = [
  { id: "finegrained" as const, num: "01", name: "Fine-grained Polarity", icon: "💬", bg: "#dbeafe" },
  { id: "aspect" as const, num: "02", name: "Aspect-Based Sentiment", icon: "👍", bg: "#e0e7ff" },
  { id: "emotion" as const, num: "03", name: "Emotion Detection", icon: "😊", bg: "#fef9c3" },
  { id: "intent" as const, num: "04", name: "Intent Classification", icon: "🧩", bg: "#ede9fe" },
  { id: "sarcasm" as const, num: "05", name: "Sarcasm Detection", icon: "🙃", bg: "#dcfce7" },
  { id: "keywords" as const, num: "06", name: "Keyword Scoring", icon: "🔑", bg: "#fce7f3" },
  { id: "topics" as const, num: "07", name: "Topic Modelling", icon: "🗂", bg: "#ffedd5" },
  { id: "trend" as const, num: "08", name: "Temporal Trend", icon: "📈", bg: "#d1fae5" },
  { id: "confidence" as const, num: "09", name: "Confidence Scoring", icon: "🎯", bg: "#f3f4f6" },
];

export const DIMENSIONS = [
  "01. Fine-grained polarity",
  "02. Aspect-based sentiment",
  "03. Emotion detection",
  "04. Intent classification",
  "05. Sarcasm detection",
  "06. High-value keyword scoring",
  "07. Topic modelling",
  "08. Temporal trend",
  "09. Confidence scoring",
];

export function themeLabel(id: string): string {
  return THEMES.find((t) => t.id === id)?.name ?? id;
}
