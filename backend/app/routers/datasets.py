from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings
from app.db.repository import repository
from app.models.schemas import DatasetUploadResponse
from app.services.ingestion import save_upload

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetUploadResponse:
    filename, file_path, columns, preview_rows, total_row_count = await save_upload(file)
    dataset_id = await repository.create_dataset(
        filename=filename,
        file_path=str(file_path),
        row_count=total_row_count,
        columns=columns,
        preview_rows=preview_rows[:5],
    )
    dataset = await repository.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=500, detail="Failed to persist dataset")

    return DatasetUploadResponse(
        dataset_id=dataset_id,
        filename=filename,
        row_count=total_row_count,
        columns=columns,
        uploaded_at=dataset["uploaded_at"],
        max_rows=settings.max_rows,
    )
