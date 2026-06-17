# SentiScan API Contract

Share this document with the **frontend** and **R** teammates. The OpenAPI spec is also live at `http://localhost:8000/docs` when the backend is running.

## Base URL

```
http://localhost:8000/api/v1
```

## Upload flow

### 1. Upload CSV

**POST** `/datasets/upload`

- Content-Type: `multipart/form-data`
- Field: `file` (CSV)

**Response:**

```json
{
  "dataset_id": "a1b2c3d4-...",
  "filename": "course_feedback.csv",
  "row_count": 50,
  "columns": ["id", "date", "comment"],
  "uploaded_at": "2026-06-14T12:00:00Z"
}
```

### 2. Start analysis

**POST** `/analysis`

```json
{
  "dataset_id": "a1b2c3d4-...",
  "text_column": "comment",
  "timestamp_column": "date",
  "is_labelled": false,
  "label_column": null
}
```

**Response:**

```json
{
  "job_id": "e5f6g7h8-...",
  "status": "pending"
}
```

### 3. Poll job status

**GET** `/analysis/{job_id}/status`

Poll every **2 seconds** until `status` is `completed` or `failed`.

```json
{
  "job_id": "e5f6g7h8-...",
  "status": "running",
  "progress": 30,
  "message": "Running sentiment pipeline"
}
```

Status values: `pending` | `running` | `completed` | `failed`

---

## Dashboard endpoints

### Summary (all 9 analysis dimensions)

**GET** `/analysis/{job_id}/summary`

```json
{
  "job_id": "e5f6g7h8-...",
  "status": "completed",
  "include_sarcasm_in_aggregates": true,
  "aggregates": {
    "polarity_distribution": {
      "Very Positive": 8,
      "Positive": 18,
      "Neutral": 12,
      "Negative": 9,
      "Very Negative": 3
    },
    "emotion_distribution": {
      "happiness": 0.32,
      "sadness": 0.14,
      "anger": 0.11,
      "fear": 0.08,
      "surprise": 0.18,
      "disgust": 0.07
    },
    "intent_distribution": {
      "complaint": 14,
      "suggestion": 10,
      "inquiry": 6,
      "compliment": 15,
      "statement": 5
    },
    "keywords_positive": [
      { "word": "excellent", "score": 0.42 }
    ],
    "keywords_negative": [
      { "word": "overwhelming", "score": -0.41 }
    ],
    "topics": [
      {
        "id": 1,
        "label": "Teaching & Lectures",
        "keywords": ["lectures", "professor"],
        "sentiment_profile": { "Positive": 22, "Neutral": 5, "Negative": 3 }
      }
    ],
    "temporal_trend": [
      { "period": "2025-01", "avg_polarity": 0.35 }
    ],
    "sarcasm_count": 7,
    "word_cloud": [
      { "word": "lectures", "weight": 18 }
    ]
  }
}
```

### Entries (paginated + filters)

**GET** `/analysis/{job_id}/entries`

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `polarity` | string | e.g. `Negative`, `Positive` |
| `emotion` | string | e.g. `anger` (entries where emotion >= 0.3) |
| `intent` | string | e.g. `complaint` |
| `sarcasm` | boolean | `true` or `false` |
| `min_confidence` | float | 0.0–1.0 |
| `page` | int | default 1 |
| `limit` | int | default 20, max 100 |

**Response:**

```json
{
  "job_id": "e5f6g7h8-...",
  "total": 50,
  "page": 1,
  "limit": 20,
  "entries": [
    {
      "job_id": "e5f6g7h8-...",
      "row_index": 1,
      "original_text": "Too much workload for one semester.",
      "original_row": { "id": "2", "date": "2025-01-18", "comment": "..." },
      "polarity": "Negative",
      "polarity_confidence": 0.81,
      "emotions": {
        "happiness": 0.1,
        "sadness": 0.25,
        "anger": 0.35,
        "fear": 0.1,
        "surprise": 0.1,
        "disgust": 0.2
      },
      "intent": "complaint",
      "sarcasm_flag": false,
      "sarcasm_confidence": 0.08,
      "aspects": [
        { "term": "workload", "sentiment": "Negative", "score": -0.78 }
      ],
      "topics": [{ "topic_id": 2, "weight": 0.55 }]
    }
  ]
}
```

### Single entry drill-down

**GET** `/analysis/{job_id}/entries/{row_index}`

Returns one `EntryDocument` object (same shape as items in `entries` array above).

### Sarcasm toggle (US-08)

**PATCH** `/analysis/{job_id}/settings`

```json
{
  "include_sarcasm_in_aggregates": false
}
```

---

## Export

### Annotated CSV

**GET** `/analysis/{job_id}/export/csv`

Returns a CSV file with original columns plus:

- `sentiscan_polarity`
- `sentiscan_polarity_confidence`
- `sentiscan_intent`
- `sentiscan_sarcasm_flag`
- `sentiscan_sarcasm_confidence`
- `sentiscan_dominant_emotion`
- `sentiscan_emotion_scores`

### PDF (not implemented)

**GET** `/analysis/{job_id}/export/pdf` → HTTP 501

---

## R Output Schema

The R engine must write JSON to `--output` with this structure:

```json
{
  "entries": [
    {
      "row_index": 0,
      "polarity": "Positive",
      "polarity_confidence": 0.87,
      "emotions": { "happiness": 0.6, "anger": 0.05 },
      "intent": "complaint",
      "sarcasm_flag": false,
      "sarcasm_confidence": 0.12,
      "aspects": [{ "term": "teaching quality", "sentiment": "Negative", "score": -0.7 }],
      "topics": [{ "topic_id": 1, "weight": 0.4 }]
    }
  ],
  "aggregates": {
    "polarity_distribution": {},
    "emotion_distribution": {},
    "intent_distribution": {},
    "keywords_positive": [],
    "keywords_negative": [],
    "topics": [],
    "temporal_trend": [],
    "sarcasm_count": 0,
    "word_cloud": []
  }
}
```

**CLI:**

```bash
Rscript run_analysis.R --input data.csv --config config.json --output results.json
```

**Config JSON** (written by backend):

```json
{
  "dataset_id": "...",
  "text_column": "comment",
  "timestamp_column": "date",
  "is_labelled": false,
  "label_column": null,
  "row_count": 50
}
```

---

## Example fixture files

- Sample input: `sample-data/course_feedback.csv`
- R stub template: `r-engine/stub_results.json`
- Full example responses: `docs/examples/summary_response.json`, `docs/examples/entries_response.json`
