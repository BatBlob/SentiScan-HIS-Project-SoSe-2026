import csv
import io
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.config import settings

KNOWN_HEADER_NAMES = {
    "raw_text",
    "text",
    "comment",
    "content",
    "review",
    "label",
    "id",
    "date",
    "timestamp",
}

LABEL_VALUES = {"pos", "neg", "neutral", "positive", "negative"}


def _decode_content(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Unable to decode file; use UTF-8 encoding")


def _looks_like_headerless_two_column(row: list[str]) -> bool:
    if len(row) != 2:
        return False
    text, label = row[0].strip(), row[1].strip().lower()
    if not text or not label:
        return False
    if label not in LABEL_VALUES:
        return False
    if text.strip().lower() in KNOWN_HEADER_NAMES:
        return False
    return True


def _parse_headerless_rows(text: str) -> tuple[list[str], list[dict[str, Any]]]:
    columns = ["raw_text", "label"]
    rows: list[dict[str, Any]] = []
    reader = csv.reader(io.StringIO(text))
    for values in reader:
        if len(values) < 2:
            continue
        raw_text = values[0].strip()
        label = values[1].strip()
        if not raw_text and not label:
            continue
        rows.append({"raw_text": raw_text, "label": label})
        if len(rows) >= settings.max_rows:
            break
    return columns, rows


def parse_csv(content: bytes) -> tuple[list[str], list[dict[str, Any]]]:
    text = _decode_content(content)
    peek = csv.reader(io.StringIO(text))
    first_row = next(peek, None)
    if first_row is None:
        raise HTTPException(status_code=400, detail="CSV is empty")

    if _looks_like_headerless_two_column(first_row):
        columns, rows = _parse_headerless_rows(text)
    else:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV has no header row")

        columns = [c.strip() for c in reader.fieldnames if c and c.strip()]
        rows = []
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
