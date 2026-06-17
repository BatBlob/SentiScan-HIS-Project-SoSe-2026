export function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

export function pctLabel(count: number, total: number): string {
  return `${pct(count, total)}%`;
}

export function sumValues(obj: Record<string, number>): number {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

export function formatIntent(intent: string): string {
  if (intent === "statement") return "General";
  return intent.charAt(0).toUpperCase() + intent.slice(1);
}

export function formatEmotion(key: string): string {
  const map: Record<string, string> = {
    happiness: "Joy",
    sadness: "Sadness",
    anger: "Anger",
    fear: "Fear",
    surprise: "Surprise",
    disgust: "Disgust",
  };
  return map[key] ?? key;
}

export function dominantEmotion(emotions: Record<string, number>): string {
  const entries = Object.entries(emotions);
  if (!entries.length) return "—";
  return formatEmotion(entries.sort((a, b) => b[1] - a[1])[0][0]);
}

export function truncate(text: string, max = 40): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function polarityBadgeClass(polarity: string): string {
  if (polarity.includes("Negative")) return "badge badge-neg";
  if (polarity.includes("Positive")) return "badge badge-pos";
  return "badge badge-neu";
}
