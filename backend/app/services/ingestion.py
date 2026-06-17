import csv
import io
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.config import settings


def _decode_content(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Unable to decode file; use UTF-8 encoding")


def parse_csv(content: bytes) -> tuple[list[str], list[dict[str, Any]]]:
    text = _decode_content(content)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")

    columns = [c.strip() for c in reader.fieldnames if c and c.strip()]
    rows: list[dict[str, Any]] = []
    for row in reader:
        cleaned = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}
        if any(cleaned.values()):
            rows.append(cleaned)
        if len(rows) >= settings.max_rows:
            break

    if not rows:
        raise HTTPException(status_code=400, detail="CSV contains no data rows")

    return columns, rows


async def save_upload(file: UploadFile) -> tuple[str, Path, list[str], list[dict[str, Any]]]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    columns, rows = parse_csv(content)
    if len(rows) > settings.max_rows:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset exceeds maximum of {settings.max_rows} rows",
        )

    safe_name = Path(file.filename).name.replace(" ", "_")
    dest = settings.upload_path / safe_name
    counter = 1
    while dest.exists():
        dest = settings.upload_path / f"{Path(safe_name).stem}_{counter}{Path(safe_name).suffix}"
        counter += 1

    dest.write_bytes(content)
    return file.filename, dest, columns, rows


def validate_text_column(columns: list[str], text_column: str) -> None:
    if text_column not in columns:
        raise HTTPException(
            status_code=400,
            detail=f"Text column '{text_column}' not found. Available: {columns}",
        )


def load_csv_rows(file_path: str) -> list[dict[str, Any]]:
    path = Path(file_path)
    content = path.read_bytes()
    _, rows = parse_csv(content)
    return rows
