import json
from datetime import datetime, timezone

from app.config import settings
from app.db.repository import repository
from app.models.schemas import (
    AnalysisConfig,
    EntryDocument,
    JobStatus,
)
from app.services.ingestion import load_csv_rows, validate_text_column
from app.services.ml_client import get_polarity_predictions
from app.services.pipeline_assembler import assemble_analysis_output, build_r_documents
from app.services.r_client import get_r_analysis


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
        message="Starting dual-pipeline analysis",
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
        rows = load_csv_rows(dataset["file_path"])
        texts = [str(row.get(config.text_column, "")) for row in rows]

        await repository.update_job(
            job_id,
            progress=25,
            message="Running ML polarity model",
        )
        ml_predictions = await get_polarity_predictions(texts)

        documents = build_r_documents(
            rows,
            text_column=config.text_column,
            is_labelled=config.is_labelled,
            label_column=config.label_column,
        )

        await repository.update_job(
            job_id,
            progress=50,
            message="Running R aggregate analysis",
        )
        r_result = await get_r_analysis(documents)
        r_response = r_result.data
        r_pipeline_error = r_result.error

        await repository.update_job(
            job_id,
            progress=70,
            message="Assembling results",
        )
        result = assemble_analysis_output(
            rows,
            ml_predictions,
            r_response,
            text_column=config.text_column,
            timestamp_column=config.timestamp_column,
            is_labelled=config.is_labelled,
            label_column=config.label_column,
        )

        output_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")

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
            r_pipeline_error=r_pipeline_error,
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
