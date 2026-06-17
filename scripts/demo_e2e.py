"""End-to-end demo script for the SentiScan backend."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

BASE = "http://localhost:8000"
SAMPLE = Path(__file__).resolve().parents[1] / "sample-data" / "course_feedback.csv"


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=60.0) as client:
        health = client.get("/health")
        health.raise_for_status()
        print("Health:", health.json())

        with SAMPLE.open("rb") as handle:
            upload = client.post(
                "/api/v1/datasets/upload",
                files={"file": ("course_feedback.csv", handle, "text/csv")},
            )
        upload.raise_for_status()
        dataset = upload.json()
        print("Upload:", json.dumps(dataset, indent=2, default=str))

        analysis = client.post(
            "/api/v1/analysis",
            json={
                "dataset_id": dataset["dataset_id"],
                "text_column": "comment",
                "timestamp_column": "date",
                "is_labelled": False,
            },
        )
        analysis.raise_for_status()
        job = analysis.json()
        job_id = job["job_id"]
        print("Job started:", job_id)

        for _ in range(30):
            status = client.get(f"/api/v1/analysis/{job_id}/status")
            status.raise_for_status()
            payload = status.json()
            print("Status:", payload)
            if payload["status"] in {"completed", "failed"}:
                break
            time.sleep(0.5)

        if payload["status"] != "completed":
            print("Analysis did not complete", file=sys.stderr)
            return 1

        summary = client.get(f"/api/v1/analysis/{job_id}/summary")
        summary.raise_for_status()
        print("Summary keys:", list(summary.json()["aggregates"].keys()))

        entries = client.get(
            f"/api/v1/analysis/{job_id}/entries",
            params={"intent": "complaint", "limit": 5},
        )
        entries.raise_for_status()
        print("Filtered entries:", entries.json()["total"])

        export = client.get(f"/api/v1/analysis/{job_id}/export/csv")
        export.raise_for_status()
        out = Path(__file__).resolve().parents[1] / "uploads" / "demo_export.csv"
        out.write_bytes(export.content)
        print("Export saved:", out)

    print("E2E demo passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
