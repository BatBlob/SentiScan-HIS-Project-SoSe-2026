import csv
import io
from pathlib import Path
from typing import Any

from app.db.repository import repository


ANNOTATION_COLUMNS = [
    "sentiscan_polarity",
    "sentiscan_polarity_confidence",
    "sentiscan_intent",
    "sentiscan_sarcasm_flag",
    "sentiscan_sarcasm_confidence",
    "sentiscan_dominant_emotion",
    "sentiscan_emotion_scores",
]


async def build_annotated_csv(job_id: str) -> tuple[str, bytes]:
    job = await repository.get_job(job_id)
    if not job:
        raise ValueError("Job not found")
    if job["status"] != "completed":
        raise ValueError("Analysis not completed")

    dataset = await repository.get_dataset(job["dataset_id"])
    if not dataset:
        raise ValueError("Dataset not found")

    entries = await repository.get_all_entries(job_id)
    entry_by_index = {e["row_index"]: e for e in entries}

    source_path = Path(dataset["file_path"])
    content = source_path.read_bytes()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = list(reader.fieldnames or []) + ANNOTATION_COLUMNS

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()

    for row_index, row in enumerate(reader):
        annotated = dict(row)
        entry = entry_by_index.get(row_index)
        if entry:
            dominant_emotion = _dominant_emotion(entry.get("emotions", {}))
            annotated.update(
                {
                    "sentiscan_polarity": entry.get("polarity", ""),
                    "sentiscan_polarity_confidence": entry.get("polarity_confidence", ""),
                    "sentiscan_intent": entry.get("intent", ""),
                    "sentiscan_sarcasm_flag": entry.get("sarcasm_flag", False),
                    "sentiscan_sarcasm_confidence": entry.get("sarcasm_confidence", ""),
                    "sentiscan_dominant_emotion": dominant_emotion,
                    "sentiscan_emotion_scores": _format_emotions(entry.get("emotions", {})),
                }
            )
        writer.writerow(annotated)

    filename = f"sentiscan_{job_id[:8]}_annotated.csv"
    return filename, output.getvalue().encode("utf-8-sig")


def _dominant_emotion(emotions: dict[str, Any]) -> str:
    if not emotions:
        return ""
    return max(emotions.items(), key=lambda item: item[1])[0]


def _format_emotions(emotions: dict[str, Any]) -> str:
    if not emotions:
        return ""
    return "; ".join(f"{k}={v}" for k, v in emotions.items())
