import asyncio

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.db.repository import repository
from app.models.schemas import (
    Aggregates,
    AnalysisConfig,
    AnalysisStartResponse,
    EntryDocument,
    EntryListResponse,
    JobSettingsResponse,
    JobSettingsUpdate,
    JobStatus,
    JobStatusResponse,
    SummaryResponse,
)
from app.services.analysis_runner import run_analysis_job
from app.services.export import build_annotated_csv

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisStartResponse)
async def start_analysis(config: AnalysisConfig) -> AnalysisStartResponse:
    dataset = await repository.get_dataset(config.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    job_id = await repository.create_job(config.dataset_id, config)
    asyncio.create_task(run_analysis_job(job_id))

    return AnalysisStartResponse(job_id=job_id, status=JobStatus.PENDING)


@router.get("/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str) -> JobStatusResponse:
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job_id,
        status=JobStatus(job["status"]),
        progress=job.get("progress", 0),
        message=job.get("message", ""),
    )


@router.get("/{job_id}/summary", response_model=SummaryResponse)
async def get_summary(job_id: str) -> SummaryResponse:
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(status_code=409, detail="Analysis not completed yet")

    aggregates_doc = await repository.get_aggregates(job_id)
    if not aggregates_doc:
        raise HTTPException(status_code=404, detail="Aggregates not found")

    aggregates = Aggregates.model_validate(
        {k: v for k, v in aggregates_doc.items() if k not in {"_id", "job_id"}}
    )

    return SummaryResponse(
        job_id=job_id,
        status=JobStatus(job["status"]),
        include_sarcasm_in_aggregates=job.get("include_sarcasm_in_aggregates", True),
        aggregates=aggregates,
    )


@router.get("/{job_id}/entries", response_model=EntryListResponse)
async def list_entries(
    job_id: str,
    polarity: str | None = None,
    emotion: str | None = None,
    intent: str | None = None,
    sarcasm: bool | None = None,
    min_confidence: float | None = Query(default=None, ge=0.0, le=1.0),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> EntryListResponse:
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(status_code=409, detail="Analysis not completed yet")

    entries, total = await repository.get_entries(
        job_id,
        polarity=polarity,
        emotion=emotion,
        intent=intent,
        sarcasm=sarcasm,
        min_confidence=min_confidence,
        page=page,
        limit=limit,
    )

    return EntryListResponse(
        job_id=job_id,
        total=total,
        page=page,
        limit=limit,
        entries=[EntryDocument.model_validate(e) for e in entries],
    )


@router.get("/{job_id}/entries/{row_index}", response_model=EntryDocument)
async def get_entry(job_id: str, row_index: int) -> EntryDocument:
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(status_code=409, detail="Analysis not completed yet")

    entry = await repository.get_entry(job_id, row_index)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    return EntryDocument.model_validate(entry)


@router.patch("/{job_id}/settings", response_model=JobSettingsResponse)
async def update_settings(job_id: str, settings: JobSettingsUpdate) -> JobSettingsResponse:
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await repository.update_job(
        job_id,
        include_sarcasm_in_aggregates=settings.include_sarcasm_in_aggregates,
    )

    return JobSettingsResponse(
        job_id=job_id,
        include_sarcasm_in_aggregates=settings.include_sarcasm_in_aggregates,
    )


@router.get("/{job_id}/export/csv")
async def export_csv(job_id: str) -> Response:
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != JobStatus.COMPLETED.value:
        raise HTTPException(status_code=409, detail="Analysis not completed yet")

    try:
        filename, content = await build_annotated_csv(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{job_id}/export/pdf")
async def export_pdf(job_id: str) -> Response:
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    raise HTTPException(status_code=501, detail="PDF export is not implemented yet")
