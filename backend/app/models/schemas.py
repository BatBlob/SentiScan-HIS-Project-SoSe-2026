from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Polarity(str, Enum):
    VERY_POSITIVE = "Very Positive"
    POSITIVE = "Positive"
    NEUTRAL = "Neutral"
    NEGATIVE = "Negative"
    VERY_NEGATIVE = "Very Negative"


class Intent(str, Enum):
    COMPLAINT = "complaint"
    SUGGESTION = "suggestion"
    INQUIRY = "inquiry"
    COMPLIMENT = "compliment"
    STATEMENT = "statement"


class AspectScore(BaseModel):
    term: str
    sentiment: str
    score: float


class TopicWeight(BaseModel):
    topic_id: int
    weight: float


class EntryResult(BaseModel):
    row_index: int
    polarity: str
    polarity_confidence: float
    emotions: dict[str, float] = Field(default_factory=dict)
    intent: str
    sarcasm_flag: bool = False
    sarcasm_confidence: float = 0.0
    aspects: list[AspectScore] = Field(default_factory=list)
    topics: list[TopicWeight] = Field(default_factory=list)


class KeywordScore(BaseModel):
    word: str
    score: float


class TopicAggregate(BaseModel):
    id: int
    label: str
    keywords: list[str] = Field(default_factory=list)
    sentiment_profile: dict[str, Any] = Field(default_factory=dict)


class TemporalPoint(BaseModel):
    period: str
    avg_polarity: float


class WordCloudItem(BaseModel):
    word: str
    weight: float


class Aggregates(BaseModel):
    polarity_distribution: dict[str, int] = Field(default_factory=dict)
    emotion_distribution: dict[str, float] = Field(default_factory=dict)
    intent_distribution: dict[str, int] = Field(default_factory=dict)
    keywords_positive: list[KeywordScore] = Field(default_factory=list)
    keywords_negative: list[KeywordScore] = Field(default_factory=list)
    topics: list[TopicAggregate] = Field(default_factory=list)
    temporal_trend: list[TemporalPoint] = Field(default_factory=list)
    sarcasm_count: int = 0
    word_cloud: list[WordCloudItem] = Field(default_factory=list)


class RAnalysisOutput(BaseModel):
    entries: list[EntryResult]
    aggregates: Aggregates


class DatasetUploadResponse(BaseModel):
    dataset_id: str
    filename: str
    row_count: int
    columns: list[str]
    uploaded_at: datetime


class AnalysisConfig(BaseModel):
    dataset_id: str
    text_column: str
    timestamp_column: str | None = None
    is_labelled: bool = False
    label_column: str | None = None


class AnalysisStartResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: str = ""


class JobSettingsUpdate(BaseModel):
    include_sarcasm_in_aggregates: bool = True


class JobSettingsResponse(BaseModel):
    job_id: str
    include_sarcasm_in_aggregates: bool


class EntryDocument(BaseModel):
    job_id: str
    row_index: int
    original_text: str
    original_row: dict[str, Any] = Field(default_factory=dict)
    polarity: str
    polarity_confidence: float
    emotions: dict[str, float] = Field(default_factory=dict)
    intent: str
    sarcasm_flag: bool = False
    sarcasm_confidence: float = 0.0
    aspects: list[AspectScore] = Field(default_factory=list)
    topics: list[TopicWeight] = Field(default_factory=list)


class EntryListResponse(BaseModel):
    job_id: str
    total: int
    page: int
    limit: int
    entries: list[EntryDocument]


class SummaryResponse(BaseModel):
    job_id: str
    status: JobStatus
    include_sarcasm_in_aggregates: bool
    aggregates: Aggregates
