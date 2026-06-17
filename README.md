# SentiScan

Full-stack sentiment analysis platform: React frontend, FastAPI backend, R analysis engine.

## Quick start

### Backend

```bash
cd backend
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — upload a CSV, run analysis, view the dashboard.

### MongoDB only (Docker)

```bash
docker compose up -d mongodb
```

Or use a local MongoDB instance on `mongodb://localhost:27017`. By default `.env` uses in-memory MongoDB (`mongomock://memory`) so Docker is optional for local dev.

Open backend **Swagger UI**: http://localhost:8000/docs

By default, `.env` uses `mongomock://memory` so you can run locally without Docker. For production, set `MONGODB_URI=mongodb://localhost:27017` and start MongoDB via Docker Compose.

### Run automated demo (backend only)

With the API running:

```bash
pip install httpx
python scripts/demo_e2e.py
```

### Full stack with Docker

```bash
docker compose up --build
```

## Demo walkthrough (~10 minutes)

1. Open `/docs` and walk through the API contract with the team.
2. **Upload** `sample-data/course_feedback.csv` via `POST /api/v1/datasets/upload`.
3. **Start analysis** with `POST /api/v1/analysis`:

```json
{
  "dataset_id": "<from upload response>",
  "text_column": "comment",
  "timestamp_column": "date",
  "is_labelled": false
}
```

4. **Poll status** with `GET /api/v1/analysis/{job_id}/status` until `completed`.
5. **Fetch dashboard data** with `GET /api/v1/analysis/{job_id}/summary`.
6. **Filter entries** with `GET /api/v1/analysis/{job_id}/entries?intent=complaint&polarity=Negative`.
7. **Export CSV** with `GET /api/v1/analysis/{job_id}/export/csv`.

## curl examples

```bash
# Health check
curl http://localhost:8000/health

# Upload dataset
curl -X POST http://localhost:8000/api/v1/datasets/upload \
  -F "file=@../sample-data/course_feedback.csv"

# Start analysis (replace DATASET_ID)
curl -X POST http://localhost:8000/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d "{\"dataset_id\":\"DATASET_ID\",\"text_column\":\"comment\",\"timestamp_column\":\"date\"}"

# Poll status (replace JOB_ID)
curl http://localhost:8000/api/v1/analysis/JOB_ID/status

# Dashboard summary
curl http://localhost:8000/api/v1/analysis/JOB_ID/summary

# Filtered entries
curl "http://localhost:8000/api/v1/analysis/JOB_ID/entries?intent=complaint&page=1&limit=10"

# Download annotated CSV
curl -O -J http://localhost:8000/api/v1/analysis/JOB_ID/export/csv
```

## Architecture

```
React Frontend  →  FastAPI Backend  →  R Engine (run_analysis.R)
                          ↓
                       MongoDB
```

The backend does **not** implement sentiment algorithms. All statistical processing lives in R (`r-engine/`). For the demo, `run_analysis.R` generates realistic stub output from `stub_results.json`. If R is not installed locally, the backend falls back to an equivalent Python stub loader.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/datasets/upload` | Upload CSV, detect columns |
| POST | `/api/v1/analysis` | Start analysis job |
| GET | `/api/v1/analysis/{job_id}/status` | Job progress |
| GET | `/api/v1/analysis/{job_id}/summary` | Dashboard aggregates |
| GET | `/api/v1/analysis/{job_id}/entries` | Paginated, filterable rows |
| GET | `/api/v1/analysis/{job_id}/entries/{row_index}` | Single entry drill-down |
| PATCH | `/api/v1/analysis/{job_id}/settings` | Toggle sarcasm in aggregates |
| GET | `/api/v1/analysis/{job_id}/export/csv` | Annotated CSV download |
| GET | `/api/v1/analysis/{job_id}/export/pdf` | Not implemented (501) |

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for JSON schemas to share with frontend and R teammates.

## MongoDB collections

- `datasets` — uploaded file metadata
- `analysis_jobs` — job status, config, progress
- `entries` — per-row sentiment results
- `aggregates` — precomputed dashboard payloads

## R integration contract

```bash
Rscript run_analysis.R --input <csv> --config <json> --output <json>
```

The R script must write JSON matching the schema in `docs/API_CONTRACT.md` under **R Output Schema**.

## Team coordination

- **Frontend (Zain/Usama):** Use `/docs` OpenAPI spec; poll status every ~2s; upload via multipart form.
- **R team (Aliza/Ahmed):** Replace stub logic in `run_analysis.R` with real pipelines; keep output JSON schema stable.
- **Database (Ahmed/Hamid):** Review collection design in `app/db/repository.py`.
