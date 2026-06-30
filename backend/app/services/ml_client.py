"""Async client for the Railway ML sentiment model."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

POLARITY_CLASSES = [
    "Very Positive",
    "Positive",
    "Neutral",
    "Negative",
    "Very Negative",
]

CONFIDENCE_THRESHOLD = 0.75


def map_ml_to_five_level(sentiment: str, confidence: float) -> tuple[str, float]:
    """Map 3-class ML output + probability to 5-level polarity."""
    sentiment = sentiment.lower().strip()
    if sentiment == "positive":
        if confidence >= CONFIDENCE_THRESHOLD:
            return "Very Positive", confidence
        return "Positive", confidence
    if sentiment == "negative":
        if confidence >= CONFIDENCE_THRESHOLD:
            return "Very Negative", confidence
        return "Negative", confidence
    return "Neutral", confidence


def _extract_scalar(value: Any) -> Any:
    if isinstance(value, list) and value:
        return value[0]
    return value


def _prediction_confidence(prediction: dict[str, Any]) -> float:
    sentiment = str(_extract_scalar(prediction.get("sentiment", "neutral"))).lower()
    probs = prediction.get("probabilities") or {}
    key = sentiment if sentiment in ("positive", "neutral", "negative") else "neutral"
    raw = probs.get(key, 0.5)
    try:
        return float(_extract_scalar(raw))
    except (TypeError, ValueError):
        return 0.5


def _stub_predictions(texts: list[str]) -> list[dict[str, Any]]:
    return [
        {
            "polarity_class": POLARITY_CLASSES[i % len(POLARITY_CLASSES)],
            "polarity_confidence": round(0.65 + (i % 5) * 0.05, 2),
        }
        for i in range(len(texts))
    ]


async def get_polarity_predictions(texts: list[str]) -> list[dict[str, Any]]:
    """
    POST /predict with { "texts": [...] }.
    Returns [{ polarity_class, polarity_confidence }, ...] per entry.
    Falls back to stub cycling when the model is unreachable.
    """
    if not texts:
        return []

    base_url = (settings.ml_model_url or "").strip().rstrip("/")
    if not base_url:
        logger.warning("ML_MODEL_URL not configured; using stub polarity")
        return _stub_predictions(texts)

    url = f"{base_url}/predict"
    try:
        async with httpx.AsyncClient(timeout=settings.ml_request_timeout) as client:
            response = await client.post(url, json={"texts": texts})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("ML model unreachable (%s); using stub polarity", exc)
        return _stub_predictions(texts)

    predictions = payload.get("predictions") or []
    if len(predictions) != len(texts):
        logger.warning(
            "ML model returned %d predictions for %d texts; using stub polarity",
            len(predictions),
            len(texts),
        )
        return _stub_predictions(texts)

    results: list[dict[str, Any]] = []
    for pred in predictions:
        sentiment = str(_extract_scalar(pred.get("sentiment", "neutral"))).lower()
        confidence = _prediction_confidence(pred)
        polarity_class, polarity_confidence = map_ml_to_five_level(sentiment, confidence)
        results.append(
            {
                "polarity_class": polarity_class,
                "polarity_confidence": round(polarity_confidence, 4),
            }
        )
    return results
