"""Async client for the local R Plumber analysis API."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RAnalysisResult:
    data: dict[str, Any] | None
    error: str | None = None


def _parse_r_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict) and payload.get("error"):
            return str(payload["error"])
    except ValueError:
        pass
    return response.text.strip() or f"HTTP {response.status_code}"


async def get_r_analysis(documents: list[dict[str, str]]) -> RAnalysisResult:
    """
    POST /analyze with { "documents": [{ "raw_text", "label" }, ...] }.
    Returns parsed R JSON or an error message when the call fails.
    """
    if not documents:
        return RAnalysisResult(data=None, error="No documents to send to R pipeline")

    base_url = (settings.r_plumber_url or "").strip().rstrip("/")
    if not base_url:
        return RAnalysisResult(data=None, error="R_PLUMBER_URL is not configured")

    url = f"{base_url}/analyze"
    try:
        async with httpx.AsyncClient(timeout=settings.r_plumber_request_timeout) as client:
            response = await client.post(url, json={"documents": documents})
            if response.status_code >= 400:
                error = _parse_r_error(response)
                logger.warning("R Plumber returned %s: %s", response.status_code, error)
                return RAnalysisResult(data=None, error=error)
            return RAnalysisResult(data=response.json())
    except httpx.HTTPError as exc:
        logger.warning("R Plumber unreachable (%s)", exc)
        return RAnalysisResult(
            data=None,
            error=f"Could not reach R Plumber at {base_url}: {exc}",
        )
    except ValueError as exc:
        logger.warning("R Plumber returned invalid JSON (%s)", exc)
        return RAnalysisResult(data=None, error="R Plumber returned invalid JSON")
