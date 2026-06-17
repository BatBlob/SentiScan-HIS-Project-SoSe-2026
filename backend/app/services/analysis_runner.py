import json
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.db.repository import repository
from app.models.schemas import (
    AnalysisConfig,
    EntryDocument,
    JobStatus,
)
from app.services.ingestion import load_csv_rows, validate_text_column
from app.services.r_bridge import run_r_analysis


async def run_analysis_job(job_id: str) -> None:
    job = await repository.get_job(job_id)
    if not job:
        return

    dataset = await repository.get_dataset(job["dataset_id"])
    if not dataset:
        await repository.update_job(
            job_id,
            status=JobStatus.FAILED,
            progress=100,
            message="Dataset not found",
            error="Dataset not found",
            completed_at=datetime.now(timezone.utc),
        )
        return

    config = AnalysisConfig.model_validate(job["config"])
    validate_text_column(dataset["columns"], config.text_column)
    if config.timestamp_column:
        validate_text_column(dataset["columns"], config.timestamp_column)
    if config.label_column:
        validate_text_column(dataset["columns"], config.label_column)

    await repository.update_job(
        job_id,
        status=JobStatus.RUNNING,
        progress=10,
        message="Starting R analysis",
        started_at=datetime.now(timezone.utc),
    )

    job_dir = settings.upload_path / "jobs" / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    config_path = job_dir / "config.json"
    output_path = job_dir / "results.json"

    config_path.write_text(
        json.dumps(
            {
                **config.model_dump(),
                "row_count": dataset["row_count"],
            }
        ),
        encoding="utf-8",
    )

    try:
        await repository.update_job(job_id, progress=30, message="Running sentiment pipeline")
        result = await run_r_analysis(
            Path(dataset["file_path"]),
            config_path,
            output_path,
        )

        await repository.update_job(job_id, progress=70, message="Saving results")
        rows = load_csv_rows(dataset["file_path"])
        entries: list[EntryDocument] = []

        for entry in result.entries:
            original_row = rows[entry.row_index] if entry.row_index < len(rows) else {}
            text = original_row.get(config.text_column, "")
            entries.append(
                EntryDocument(
                    job_id=job_id,
                    row_index=entry.row_index,
                    original_text=str(text),
                    original_row=original_row,
                    polarity=entry.polarity,
                    polarity_confidence=entry.polarity_confidence,
                    emotions=entry.emotions,
                    intent=entry.intent,
                    sarcasm_flag=entry.sarcasm_flag,
                    sarcasm_confidence=entry.sarcasm_confidence,
                    aspects=entry.aspects,
                    topics=entry.topics,
                )
            )

        await repository.save_results(job_id, entries, result.aggregates)
        await repository.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            message="Analysis completed",
            completed_at=datetime.now(timezone.utc),
        )
    except Exception as exc:
        await repository.update_job(
            job_id,
            status=JobStatus.FAILED,
            progress=100,
            message="Analysis failed",
            error=str(exc),
            completed_at=datetime.now(timezone.utc),
        )
