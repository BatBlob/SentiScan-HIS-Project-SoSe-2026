import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJobStatus, saveSessionMeta, startAnalysis, uploadDataset } from "../api/client";
import { ConfigGrid, StepsRow, UploadZone } from "../components/upload/UploadForm";

export function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [columns, setColumns] = useState<string[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [filename, setFilename] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [textColumn, setTextColumn] = useState("");
  const [timestampColumn, setTimestampColumn] = useState("");
  const [hasTimestamp, setHasTimestamp] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are supported.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const res = await uploadDataset(file);
      setDatasetId(res.dataset_id);
      setFilename(res.filename);
      setRowCount(res.row_count);
      setColumns(res.columns);
      const textGuess = res.columns.find((c) => /text|comment|review|body|content/i.test(c)) ?? res.columns[0] ?? "";
      const dateGuess = res.columns.find((c) => /date|time|created|timestamp/i.test(c)) ?? "";
      setTextColumn(textGuess);
      setTimestampColumn(dateGuess);
      setHasTimestamp(!!dateGuess);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const runAnalysis = async () => {
    if (!datasetId || !textColumn) {
      setError("Select a text column before running analysis.");
      return;
    }
    setError("");
    setAnalyzing(true);
    setStep(3);
    try {
      const { job_id } = await startAnalysis({
        dataset_id: datasetId,
        text_column: textColumn,
        timestamp_column: hasTimestamp && timestampColumn ? timestampColumn : null,
        is_labelled: false,
      });
      saveSessionMeta(job_id, { filename, row_count: rowCount, dataset_id: datasetId });

      const poll = async (): Promise<void> => {
        const status = await getJobStatus(job_id);
        setProgress(status.progress);
        setProgressMsg(status.message);
        if (status.status === "completed") {
          navigate(`/dashboard/${job_id}`);
          return;
        }
        if (status.status === "failed") {
          throw new Error(status.message || "Analysis failed");
        }
        await new Promise((r) => setTimeout(r, 2000));
        await poll();
      };
      await poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStep(2);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (columns.length && textColumn) setStep((s) => (s < 2 ? 2 : s));
  }, [columns, textColumn]);

  return (
    <div className="app">
      <div className="app-bar">
        <div className="app-logo">SentiScan</div>
      </div>
      <div className="app-content">
        <div style={{ fontSize: 20, fontWeight: "bold", marginBottom: 4 }}>Upload &amp; Configure</div>
        <div style={{ fontSize: 12, color: "#777", marginBottom: 24 }}>
          Upload any text dataset. No programming knowledge required.
        </div>

        <StepsRow step={step} />

        <UploadZone onFile={handleFile} filename={filename} error={undefined} disabled={uploading || analyzing} />

        {columns.length > 0 && (
          <ConfigGrid
            columns={columns}
            textColumn={textColumn}
            timestampColumn={timestampColumn}
            hasTimestamp={hasTimestamp}
            onTextColumn={setTextColumn}
            onTimestampColumn={setTimestampColumn}
            onHasTimestamp={setHasTimestamp}
          />
        )}

        {step === 3 && analyzing && (
          <div className="progress-box">
            <div style={{ fontSize: 12, color: "#555" }}>{progressMsg || "Running analysis..."}</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && <div className="error-msg">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn" onClick={() => navigate("/")} disabled={analyzing}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-dark"
            disabled={!datasetId || !textColumn || analyzing || uploading}
            onClick={runAnalysis}
          >
            Run Analysis →
          </button>
        </div>
      </div>
    </div>
  );
}
