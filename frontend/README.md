# SentiScan Frontend

React + Vite frontend matching the wireframe in `../wireframe/sentiscan.html`, connected to the FastAPI backend.

## Prerequisites

- Node.js 18+
- Backend running at `http://localhost:8000`

## Setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

The Vite dev server proxies `/api` to the backend.

## Demo flow

1. Start backend: `cd ../backend && uvicorn app.main:app --reload --port 8000`
2. Start frontend: `npm run dev`
3. Upload `../sample-data/course_feedback.csv`
4. Select text column `comment` and timestamp column `date`
5. Click **Run Analysis →** — redirects to dashboard when complete
6. Browse all 9 analysis themes in the sidebar; use filters and export

## Build

```bash
npm run build
npm run preview
```

## API

All requests go to `VITE_API_BASE` (default `/api/v1`). See `../docs/API_CONTRACT.md`.
