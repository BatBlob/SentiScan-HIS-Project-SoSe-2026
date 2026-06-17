import asyncio
import csv
import json
import random
import shutil
import subprocess
from pathlib import Path

from app.config import settings
from app.models.schemas import Aggregates, EntryResult, RAnalysisOutput


async def run_r_analysis(
    input_csv: Path,
    config_path: Path,
    output_path: Path,
) -> RAnalysisOutput:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    r_script = settings.r_script

    if not r_script.exists():
        raise FileNotFoundError(f"R script not found: {r_script}")

    r_executable = shutil.which(settings.r_executable)
    if r_executable:
        cmd = [
            r_executable,
            str(r_script),
            "--input",
            str(input_csv),
            "--config",
            str(config_path),
            "--output",
            str(output_path),
        ]

        def _run() -> subprocess.CompletedProcess[str]:
            return subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )

        result = await asyncio.to_thread(_run)

        if result.returncode == 0 and output_path.exists():
            data = json.loads(output_path.read_text(encoding="utf-8"))
            return RAnalysisOutput.model_validate(data)

        stderr = result.stderr.strip() or result.stdout.strip() or "Unknown R error"
        raise RuntimeError(f"R analysis failed: {stderr}")

    result = _run_python_stub(input_csv, output_path)
    output_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    return result


def _run_python_stub(input_csv: Path, output_path: Path) -> RAnalysisOutput:
    stub_path = settings.r_script.parent / "stub_results.json"
    if not stub_path.exists():
        raise FileNotFoundError(f"Stub results not found: {stub_path}")

    stub = json.loads(stub_path.read_text(encoding="utf-8"))
    template_entries = stub["entries"]
    aggregates = Aggregates.model_validate(stub["aggregates"])

    with input_csv.open(encoding="utf-8-sig", newline="") as handle:
        row_count = sum(1 for _ in csv.DictReader(handle))

    polarities = [
        "Very Positive",
        "Positive",
        "Neutral",
        "Negative",
        "Very Negative",
    ]
    intents = ["complaint", "suggestion", "inquiry", "compliment", "statement"]
    entries: list[EntryResult] = []

    for i in range(row_count):
        template = template_entries[i % len(template_entries)]
        sarcasm = i % 7 == 0
        p_idx = i % len(polarities)
        entries.append(
            EntryResult(
                row_index=i,
                polarity=polarities[p_idx],
                polarity_confidence=round(random.uniform(0.62, 0.95), 2),
                emotions=template["emotions"],
                intent=intents[i % len(intents)],
                sarcasm_flag=sarcasm,
                sarcasm_confidence=round(random.uniform(0.7, 0.92), 2)
                if sarcasm
                else round(random.uniform(0.05, 0.25), 2),
                aspects=template.get("aspects", []),
                topics=template.get("topics", []),
            )
        )

    aggregates.sarcasm_count = sum(1 for e in entries if e.sarcasm_flag)
    return RAnalysisOutput(entries=entries, aggregates=aggregates)
