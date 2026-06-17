export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface DatasetUploadResponse {
  dataset_id: string;
  filename: string;
  row_count: number;
  columns: string[];
  uploaded_at: string;
}

export interface AnalysisConfig {
  dataset_id: string;
  text_column: string;
  timestamp_column?: string | null;
  is_labelled?: boolean;
  label_column?: string | null;
}

export interface AnalysisStartResponse {
  job_id: string;
  status: JobStatus;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
}

export interface AspectScore {
  term: string;
  sentiment: string;
  score: number;
}

export interface TopicWeight {
  topic_id: number;
  weight: number;
}

export interface EntryDocument {
  job_id: string;
  row_index: number;
  original_text: string;
  original_row: Record<string, string>;
  polarity: string;
  polarity_confidence: number;
  emotions: Record<string, number>;
  intent: string;
  sarcasm_flag: boolean;
  sarcasm_confidence: number;
  aspects: AspectScore[];
  topics: TopicWeight[];
}

export interface KeywordScore {
  word: string;
  score: number;
}

export interface TopicAggregate {
  id: number;
  label: string;
  keywords: string[];
  sentiment_profile: Record<string, number>;
}

export interface TemporalPoint {
  period: string;
  avg_polarity: number;
}

export interface WordCloudItem {
  word: string;
  weight: number;
}

export interface Aggregates {
  polarity_distribution: Record<string, number>;
  emotion_distribution: Record<string, number>;
  intent_distribution: Record<string, number>;
  keywords_positive: KeywordScore[];
  keywords_negative: KeywordScore[];
  topics: TopicAggregate[];
  temporal_trend: TemporalPoint[];
  sarcasm_count: number;
  word_cloud: WordCloudItem[];
}

export interface SummaryResponse {
  job_id: string;
  status: JobStatus;
  include_sarcasm_in_aggregates: boolean;
  aggregates: Aggregates;
}

export interface EntryListResponse {
  job_id: string;
  total: number;
  page: number;
  limit: number;
  entries: EntryDocument[];
}

export interface JobSettingsResponse {
  job_id: string;
  include_sarcasm_in_aggregates: boolean;
}

export interface SessionMeta {
  filename: string;
  row_count: number;
  dataset_id: string;
}

export type ThemeId =
  | "finegrained"
  | "aspect"
  | "emotion"
  | "intent"
  | "sarcasm"
  | "keywords"
  | "topics"
  | "trend"
  | "confidence";

export type FilterChip = "all" | "Positive" | "Negative" | "Neutral";
