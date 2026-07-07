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
  { id: "wordanalysis" as const, num: "10", name: "Word Analysis", icon: "🔤", bg: "#e0f2fe" },
];

/** @deprecated use DIMENSION_CONFIG instead */
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

/**
 * group:
 *   "ml"   — always runs (core ML polarity call, fast)
 *   "absa" — optional ABSA/intent call
 *   "r"    — optional R pipeline call (slowest)
 * locked: cannot be disabled by the user
 */
export const DIMENSION_CONFIG = [
  { id: "finegrained", num: "01", label: "Fine-grained polarity", group: "ml" as const, locked: true },
  { id: "aspect",      num: "02", label: "Aspect-based sentiment", group: "absa" as const, locked: false },
  { id: "emotion",     num: "03", label: "Emotion detection",      group: "r" as const,    locked: false },
  { id: "intent",      num: "04", label: "Intent classification",  group: "absa" as const, locked: false },
  { id: "sarcasm",     num: "05", label: "Sarcasm detection",      group: "ml" as const,   locked: false },
  { id: "keywords",    num: "06", label: "High-value keyword scoring", group: "r" as const, locked: false },
  { id: "topics",      num: "07", label: "Topic modelling",        group: "r" as const,    locked: false },
  { id: "trend",       num: "08", label: "Temporal trend",         group: "ml" as const,   locked: false },
  { id: "confidence",  num: "09", label: "Confidence scoring",     group: "ml" as const,   locked: false },
] as const;

export type DimensionId = typeof DIMENSION_CONFIG[number]["id"];
export const ALL_DIMENSION_IDS: DimensionId[] = DIMENSION_CONFIG.map((d) => d.id);

export function themeLabel(id: string): string {
  return THEMES.find((t) => t.id === id)?.name ?? id;
}
