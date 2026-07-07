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


def _parse_headerless_rows(text: str, limit: int | None = None) -> tuple[list[str], list[dict[str, Any]]]:
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
        if limit is not None and len(rows) >= limit:
            break
    return columns, rows


def parse_csv(content: bytes, limit: int | None = None) -> tuple[list[str], list[dict[str, Any]]]:
    """Parse CSV bytes into (columns, rows).

    limit: if given, stop reading after this many data rows.
           Pass settings.max_rows at upload time to enforce the cap.
           Pass None when loading a previously-validated file so that
           row-range selectors can reference any row in the full file.
    """
    text = _decode_content(content)
    peek = csv.reader(io.StringIO(text))
    first_row = next(peek, None)
    if first_row is None:
        raise HTTPException(status_code=400, detail="CSV is empty")

    if _looks_like_headerless_two_column(first_row):
        columns, rows = _parse_headerless_rows(text, limit=limit)
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
                if limit is not None and len(rows) >= limit:
                    break

    if not rows:
        raise HTTPException(status_code=400, detail="CSV contains no data rows")

    return columns, rows


async def save_upload(
    file: UploadFile,
) -> tuple[str, Path, list[str], list[dict[str, Any]], int]:
    """Save an uploaded CSV and return (filename, path, columns, preview_rows, total_row_count).

    Files of any row count are accepted — the hard limit is enforced later at
    analysis time (in analysis_runner) so that users can use row-range selectors
    to pick at most max_rows rows from a larger file.
    A fast two-pass approach is used: first count all rows cheaply, then parse
    only the first max_rows rows for the preview / column detection.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Count actual rows without storing them all
    text_for_count = _decode_content(content)
    reader_count = csv.DictReader(io.StringIO(text_for_count))
    if not reader_count.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")
    total_row_count = sum(
        1 for row in reader_count if any(v and v.strip() for v in row.values())
    )
    if total_row_count == 0:
        raise HTTPException(status_code=400, detail="CSV contains no data rows")

    # Parse up to max_rows for column detection / preview only
    columns, preview_rows = parse_csv(content, limit=settings.max_rows)

    safe_name = Path(file.filename).name.replace(" ", "_")
    dest = settings.upload_path / safe_name
    counter = 1
    while dest.exists():
        dest = settings.upload_path / f"{Path(safe_name).stem}_{counter}{Path(safe_name).suffix}"
        counter += 1

    dest.write_bytes(content)
    return file.filename, dest, columns, preview_rows, total_row_count


def validate_text_column(columns: list[str], text_column: str) -> None:
    if text_column not in columns:
        raise HTTPException(
            status_code=400,
            detail=f"Text column '{text_column}' not found. Available: {columns}",
        )


def filter_row_ranges(
    rows: list[dict[str, Any]],
    ranges: list[dict[str, int]] | None,
) -> list[dict[str, Any]]:
    """
    Subset rows by 1-based row ranges.
    E.g. ranges=[{"start": 1, "end": 50}, {"start": 100, "end": 150}]
    keeps rows at 1-based positions 1-50 and 100-150.
    Ranges are deduplicated and merged so rows are never duplicated.
    """
    if not ranges:
        return rows

    n = len(rows)
    keep: set[int] = set()
    for r in ranges:
        start = max(1, int(r["start"]))
        end = min(n, int(r["end"]))
        keep.update(range(start - 1, end))

    return [rows[i] for i in sorted(keep)]


def load_csv_rows(file_path: str) -> list[dict[str, Any]]:
    """Load all rows from a previously uploaded (already-validated) CSV file.

    No row limit is applied here — the file was already checked against
    max_rows at upload time, so row-range selectors can reference any row.
    """
    path = Path(file_path)
    content = path.read_bytes()
    _, rows = parse_csv(content, limit=None)
    return rows
