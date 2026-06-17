from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db.client import get_database
from app.models.schemas import (
    Aggregates,
    AnalysisConfig,
    EntryDocument,
    JobStatus,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Repository:
    @property
    def db(self):
        return get_database()

    async def create_dataset(
        self,
        filename: str,
        file_path: str,
        row_count: int,
        columns: list[str],
        preview_rows: list[dict[str, Any]],
    ) -> str:
        dataset_id = str(uuid4())
        await self.db.datasets.insert_one(
            {
                "_id": dataset_id,
                "filename": filename,
                "file_path": file_path,
                "row_count": row_count,
                "columns": columns,
                "preview_rows": preview_rows,
                "uploaded_at": _utcnow(),
            }
        )
        return dataset_id

    async def get_dataset(self, dataset_id: str) -> dict[str, Any] | None:
        return await self.db.datasets.find_one({"_id": dataset_id})

    async def create_job(self, dataset_id: str, config: AnalysisConfig) -> str:
        job_id = str(uuid4())
        await self.db.analysis_jobs.insert_one(
            {
                "_id": job_id,
                "dataset_id": dataset_id,
                "config": config.model_dump(),
                "status": JobStatus.PENDING.value,
                "progress": 0,
                "message": "Job queued",
                "error": None,
                "include_sarcasm_in_aggregates": True,
                "started_at": None,
                "completed_at": None,
                "created_at": _utcnow(),
            }
        )
        return job_id

    async def get_job(self, job_id: str) -> dict[str, Any] | None:
        return await self.db.analysis_jobs.find_one({"_id": job_id})

    async def update_job(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: int | None = None,
        message: str | None = None,
        error: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        include_sarcasm_in_aggregates: bool | None = None,
    ) -> None:
        update: dict[str, Any] = {}
        if status is not None:
            update["status"] = status.value
        if progress is not None:
            update["progress"] = progress
        if message is not None:
            update["message"] = message
        if error is not None:
            update["error"] = error
        if started_at is not None:
            update["started_at"] = started_at
        if completed_at is not None:
            update["completed_at"] = completed_at
        if include_sarcasm_in_aggregates is not None:
            update["include_sarcasm_in_aggregates"] = include_sarcasm_in_aggregates
        if update:
            await self.db.analysis_jobs.update_one({"_id": job_id}, {"$set": update})

    async def save_results(
        self,
        job_id: str,
        entries: list[EntryDocument],
        aggregates: Aggregates,
    ) -> None:
        if entries:
            await self.db.entries.insert_many(
                [{**e.model_dump(), "job_id": job_id} for e in entries]
            )
        await self.db.aggregates.update_one(
            {"_id": job_id},
            {
                "$set": {
                    "job_id": job_id,
                    **aggregates.model_dump(),
                }
            },
            upsert=True,
        )

    async def get_aggregates(self, job_id: str) -> dict[str, Any] | None:
        return await self.db.aggregates.find_one({"_id": job_id})

    async def get_entries(
        self,
        job_id: str,
        *,
        polarity: str | None = None,
        emotion: str | None = None,
        intent: str | None = None,
        sarcasm: bool | None = None,
        min_confidence: float | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        query: dict[str, Any] = {"job_id": job_id}
        if polarity:
            query["polarity"] = polarity
        if intent:
            query["intent"] = intent
        if sarcasm is not None:
            query["sarcasm_flag"] = sarcasm
        if emotion:
            query[f"emotions.{emotion}"] = {"$gte": 0.3}
        if min_confidence is not None:
            query["polarity_confidence"] = {"$gte": min_confidence}

        total = await self.db.entries.count_documents(query)
        skip = (page - 1) * limit
        cursor = (
            self.db.entries.find(query)
            .sort("row_index", 1)
            .skip(skip)
            .limit(limit)
        )
        entries = await cursor.to_list(length=limit)
        return entries, total

    async def get_entry(self, job_id: str, row_index: int) -> dict[str, Any] | None:
        return await self.db.entries.find_one({"job_id": job_id, "row_index": row_index})

    async def get_all_entries(self, job_id: str) -> list[dict[str, Any]]:
        cursor = self.db.entries.find({"job_id": job_id}).sort("row_index", 1)
        return await cursor.to_list(length=None)


repository = Repository()
