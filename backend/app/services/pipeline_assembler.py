"""Assemble ML + R pipeline results into RAnalysisOutput."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any
from app.models.schemas import (
    Aggregates,
    AspectAggregate,
    AspectScore,
    BigramScore,
    EntryResult,
    KeywordScore,
    RAnalysisOutput,
    TemporalPoint,
    TopicAggregate,
    WordCloudItem,
)

POLARITY_SCORES = {
    "Very Positive": 1.0,
    "Positive": 0.5,
    "Neutral": 0.0,
    "Negative": -0.5,
    "Very Negative": -1.0,
}

POLARITY_BUCKETS = list(POLARITY_SCORES.keys())

R_EMOTION_MAP = {
    "joy": "happiness",
    "sadness": "sadness",
    "anger": "anger",
    "fear": "fear",
    "surprise": "surprise",
    "disgust": "disgust",
    "trust": "trust",
    "anticipation": "anticipation",
}
DROP_EMOTIONS = {"positive", "negative"}


def _as_r_list(value: Any) -> list[dict[str, Any]]:
    """Normalize R/Plumber JSON lists that may arrive as dicts after auto_unbox."""
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        if not value:
            return []
        # Single list element unboxed: {"emotion": "joy", "pct": 50} or {"topic": 1, ...}
        if any(k in value for k in ("word", "emotion", "topic", "class", "bigram")):
            return [value]
        values = list(value.values())
        if values and all(isinstance(v, dict) for v in values):
            return values
        return [value]
    return []

def _normalize_r_label(raw_label: str | None, is_labelled: bool) -> str:
    if not is_labelled or raw_label is None:
        return "neutral"
    label = str(raw_label).strip().lower()
    if label in ("pos", "positive", "1"):
        return "pos"
    if label in ("neg", "negative", "0"):
        return "neg"
    if label in ("neutral", "neu", "2"):
        return "neutral"
    return "neutral"

def _map_r_documents(documents_raw: Any) -> dict[int, dict[str, Any]]:
    items = _as_r_list(documents_raw)
    out: dict[int, dict[str, Any]] = {}
    for item in items:
        doc_id = item.get("doc_id")
        if doc_id is None:
            continue
        out[int(doc_id)] = item
    return out

def _map_r_emotions(emotions_raw: Any) -> dict[str, float]:
    items = _as_r_list(emotions_raw)
    if not items:
        return {}
    mapped: dict[str, float] = {}
    for item in items:
        key = str(item.get("emotion", "")).lower()
        if key in DROP_EMOTIONS:
            continue
        our_key = R_EMOTION_MAP.get(key, key)
        if our_key in DROP_EMOTIONS:
            continue
        try:
            pct = float(item.get("pct", 0))
        except (TypeError, ValueError):
            pct = 0.0
        mapped[our_key] = round(pct / 100.0, 4)
    return mapped


def _polarity_distribution_from_ml(
    ml_predictions: list[dict[str, Any]],
) -> dict[str, int]:
    counts = Counter(p["polarity_class"] for p in ml_predictions)
    return {bucket: counts.get(bucket, 0) for bucket in POLARITY_BUCKETS}


def _is_positive_polarity(polarity: str) -> bool:
    return polarity in ("Very Positive", "Positive")


def _is_negative_polarity(polarity: str) -> bool:
    return polarity in ("Very Negative", "Negative")


def _split_keywords(
    top_words: Any,
    texts: list[str],
    polarities: list[str],
) -> tuple[list[KeywordScore], list[KeywordScore]]:
    words = _as_r_list(top_words)
    if not words:
        return [], []

    positive_texts = [
        t.lower()
        for t, p in zip(texts, polarities, strict=False)
        if _is_positive_polarity(p)
    ]
    negative_texts = [
        t.lower()
        for t, p in zip(texts, polarities, strict=False)
        if _is_negative_polarity(p)
    ]

    keywords_positive: list[KeywordScore] = []
    keywords_negative: list[KeywordScore] = []

    for item in words[:20]:
        word = str(item.get("word", "")).lower()
        if not word:
            continue
        try:
            count = float(item.get("count", 1))
        except (TypeError, ValueError):
            count = 1.0
        pos_hits = sum(1 for text in positive_texts if word in text)
        neg_hits = sum(1 for text in negative_texts if word in text)
        if pos_hits > neg_hits:
            keywords_positive.append(
                KeywordScore(word=word, score=round(min(0.95, count / 50), 2))
            )
        elif neg_hits > pos_hits:
            keywords_negative.append(
                KeywordScore(word=word, score=round(-min(0.95, count / 50), 2))
            )
        elif _is_positive_polarity(polarities[0] if polarities else "Neutral"):
            keywords_positive.append(
                KeywordScore(word=word, score=round(min(0.95, count / 50), 2))
            )
        else:
            keywords_negative.append(
                KeywordScore(word=word, score=round(-min(0.95, count / 50), 2))
            )

    return keywords_positive[:10], keywords_negative[:10]


def _word_cloud_from_r(top_words: Any) -> list[WordCloudItem]:
    words = _as_r_list(top_words)
    if not words:
        return []
    items: list[WordCloudItem] = []
    for item in words[:30]:
        word = str(item.get("word", ""))
        if not word:
            continue
        try:
            weight = float(item.get("count", 1))
        except (TypeError, ValueError):
            weight = 1.0
        items.append(WordCloudItem(word=word, weight=weight))
    return items

def _bigrams_from_r(top_bigrams_raw: Any) -> list[BigramScore]:
    items = _as_r_list(top_bigrams_raw)
    if not items:
        return []
    out: list[BigramScore] = []
    for item in items[:20]:
        bigram = str(item.get("bigram", ""))
        if not bigram:
            continue
        try:
            count = int(item.get("count", 0))
        except (TypeError, ValueError):
            count = 0
        out.append(BigramScore(bigram=bigram, count=count))
    return out

def _topics_from_r(
    topics_raw: Any,
    polarities: list[str],
) -> list[TopicAggregate]:
    topics_raw = _as_r_list(topics_raw)
    if not topics_raw:
        return []

    pos_count = sum(1 for p in polarities if _is_positive_polarity(p))
    neg_count = sum(1 for p in polarities if _is_negative_polarity(p))
    neu_count = len(polarities) - pos_count - neg_count

    topics: list[TopicAggregate] = []
    for idx, topic in enumerate(topics_raw, start=1):
        topic_id = int(topic.get("topic", idx))
        terms = topic.get("terms") or []
        if isinstance(terms, list):
            keywords = [str(t) for t in terms]
        else:
            keywords = [str(terms)]
        label = ", ".join(keywords[:3]) if keywords else f"Topic {topic_id}"
        topics.append(
            TopicAggregate(
                id=topic_id,
                label=label.title(),
                keywords=keywords,
                sentiment_profile={
                    "Positive": pos_count,
                    "Neutral": neu_count,
                    "Negative": neg_count,
                },
            )
        )
    return topics


def _temporal_trend(
    rows: list[dict[str, str]],
    ml_predictions: list[dict[str, Any]],
    timestamp_column: str | None,
) -> list[TemporalPoint]:
    if not timestamp_column:
        return []

    period_scores: dict[str, list[float]] = defaultdict(list)
    for row, pred in zip(rows, ml_predictions, strict=False):
        raw_ts = row.get(timestamp_column, "")
        if not raw_ts:
            continue
        period = _period_from_timestamp(str(raw_ts))
        if not period:
            continue
        score = POLARITY_SCORES.get(pred["polarity_class"], 0.0)
        period_scores[period].append(score)

    return [
        TemporalPoint(
            period=period,
            avg_polarity=round(sum(scores) / len(scores), 3),
        )
        for period, scores in sorted(period_scores.items())
    ]


_TIMESTAMP_FORMATS = [
    # ISO / database
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    # US style
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y",
    # Day-first style
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%d-%m-%Y",
    # Long month name
    "%B %d, %Y",
    "%b %d, %Y",
    "%d %B %Y",
    "%d %b %Y",
]


def _period_from_timestamp(raw: str) -> str | None:
    raw = raw.strip()
    if not raw:
        return None

    # Unix epoch (seconds or milliseconds) — pure integer string
    if raw.isdigit():
        ts = int(raw)
        # milliseconds: value larger than year 2100 in seconds (~4102444800)
        if ts > 4_102_444_800:
            ts //= 1000
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m")
        except (OSError, OverflowError, ValueError):
            return None

    # Float epoch (e.g. "1303862400.0")
    try:
        ts_f = float(raw)
        if ts_f > 4_102_444_800:
            ts_f /= 1000
        return datetime.fromtimestamp(ts_f, tz=timezone.utc).strftime("%Y-%m")
    except ValueError:
        pass

    # String date formats — try against truncated value to tolerate extra chars
    for fmt in _TIMESTAMP_FORMATS:
        # use full raw for formats without time, truncate to 19 chars for datetime formats
        candidate = raw[:19] if len(raw) > 10 else raw
        try:
            return datetime.strptime(candidate, fmt).strftime("%Y-%m")
        except ValueError:
            continue

    # Last resort: if value starts with YYYY- grab first 7 chars
    if len(raw) >= 7 and raw[4] == "-":
        return raw[:7]

    return None


def _build_intent_distribution(absa_predictions: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for pred in absa_predictions:
        intent = str(pred.get("intent", "")).strip().lower()
        if intent:
            counts[intent] = counts.get(intent, 0) + 1
    return counts


def _build_aspect_sentiment(absa_predictions: list[dict[str, Any]]) -> list[AspectAggregate]:
    agg: dict[str, dict[str, int]] = {}
    for pred in absa_predictions:
        for asp in pred.get("aspects", []):
            term = str(asp.get("term", "")).strip().lower()
            sent = str(asp.get("sentiment", "neutral")).lower()
            if not term:
                continue
            if term not in agg:
                agg[term] = {"positive": 0, "neutral": 0, "negative": 0, "total": 0}
            agg[term]["total"] += 1
            if sent == "positive":
                agg[term]["positive"] += 1
            elif sent == "negative":
                agg[term]["negative"] += 1
            else:
                agg[term]["neutral"] += 1
    return sorted(
        [AspectAggregate(term=t, **counts) for t, counts in agg.items()],
        key=lambda a: a.total,
        reverse=True,
    )


def assemble_analysis_output(
    rows: list[dict[str, str]],
    ml_predictions: list[dict[str, Any]],
    r_response: dict[str, Any] | None,
    *,
    absa_predictions: list[dict[str, Any]] | None = None,
    text_column: str,
    timestamp_column: str | None = None,
    is_labelled: bool = False,
    label_column: str | None = None,
) -> RAnalysisOutput:
    absa_predictions = absa_predictions or []
    shared_emotions = _map_r_emotions(r_response.get("emotions") if r_response else None)
    r_documents = _map_r_documents(r_response.get("documents") if r_response else None)

    entries: list[EntryResult] = []
    for i, (row, ml_pred) in enumerate(zip(rows, ml_predictions, strict=False)):
        doc_id = i + 1
        r_doc = r_documents.get(doc_id)
        per_doc_emotion = {r_doc["emotion"]: 1.0} if r_doc and r_doc.get("emotion") else shared_emotions

        absa = absa_predictions[i] if i < len(absa_predictions) else {}
        intent = str(absa.get("intent", "")).strip()
        aspects = [
            AspectScore(
                term=str(a["term"]),
                sentiment=str(a["sentiment"]),
                score=float(a["score"]),
            )
            for a in absa.get("aspects", [])
            if a.get("term")
        ]

        sarcasm_flag = bool(r_doc.get("sarcasm_flag", False)) if r_doc else False
        sarcasm_confidence = float(r_doc.get("sarcasm_confidence", 0.0)) if r_doc else 0.0

        entries.append(
            EntryResult(
                row_index=i,
                polarity=ml_pred["polarity_class"],
                polarity_confidence=ml_pred["polarity_confidence"],
                emotions=per_doc_emotion,
                intent=intent,
                sarcasm_flag=sarcasm_flag,
                sarcasm_confidence=round(sarcasm_confidence, 4),
                aspects=aspects,
                topics=[],
            )
        )

    texts = [str(row.get(text_column, "")) for row in rows]
    polarities = [p["polarity_class"] for p in ml_predictions]

    if r_response:
        top_words = r_response.get("top_words")
        keywords_positive, keywords_negative = _keywords_from_r(r_response.get("keyword_scores"))
        word_cloud = _word_cloud_from_r(top_words)
        top_bigrams = _bigrams_from_r(r_response.get("top_bigrams"))   # NEW
        topics = _topics_from_r(r_response.get("topics"), polarities)
        emotion_distribution = shared_emotions
    else:
        keywords_positive = []
        keywords_negative = []
        word_cloud = []
        topics = []
        emotion_distribution = {}
        top_bigrams = []

    temporal = _temporal_trend(rows, ml_predictions, timestamp_column)

    sarcasm_count = sum(1 for e in entries if e.sarcasm_flag)

    aggregates = Aggregates(
        polarity_distribution=_polarity_distribution_from_ml(ml_predictions),
        emotion_distribution=emotion_distribution,
        intent_distribution=_build_intent_distribution(absa_predictions),
        aspect_sentiment=_build_aspect_sentiment(absa_predictions),
        keywords_positive=keywords_positive,
        keywords_negative=keywords_negative,
        topics=topics,
        temporal_trend=temporal,
        sarcasm_count=sarcasm_count,
        word_cloud=word_cloud,
        top_bigrams=top_bigrams,
    )

    return RAnalysisOutput(entries=entries, aggregates=aggregates)


def build_r_documents(
    rows: list[dict[str, str]],
    *,
    text_column: str,
    is_labelled: bool = True,
    label_column: str | None = None,
) -> dict[str, list[dict[str, str]]]:
    documents: list[dict[str, str]] = []
    for row in rows:
        raw_text = str(row.get(text_column, "")).strip()
        if not raw_text:
            continue
        label_value = row.get(label_column) if label_column else None
        documents.append(
            {
                "raw_text": raw_text,
                "label": _normalize_r_label(label_value, is_labelled),
            }
        )
    return {"documents": documents}

def _keywords_from_r(keyword_scores_raw: Any) -> tuple[list[KeywordScore], list[KeywordScore]]:
    if not isinstance(keyword_scores_raw, dict):
        return [], []
    pos_items = _as_r_list(keyword_scores_raw.get("positive"))
    neg_items = _as_r_list(keyword_scores_raw.get("negative"))
    keywords_positive = [
        KeywordScore(word=str(i["word"]), score=float(i["score"]))
        for i in pos_items if "word" in i and "score" in i
    ]
    keywords_negative = [
        KeywordScore(word=str(i["word"]), score=float(i["score"]))
        for i in neg_items if "word" in i and "score" in i
    ]
    return keywords_positive[:10], keywords_negative[:10]