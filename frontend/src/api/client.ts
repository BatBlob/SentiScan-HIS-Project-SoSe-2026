const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as { detail?: string };
      detail = json.detail ?? text;
    } catch {
      /* keep text */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return res.json() as Promise<T>;
}

export async function uploadDataset(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<import("../types/api").DatasetUploadResponse>("/datasets/upload", {
    method: "POST",
    body: form,
  });
}

export async function startAnalysis(config: import("../types/api").AnalysisConfig) {
  return request<import("../types/api").AnalysisStartResponse>("/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function getJobStatus(jobId: string) {
  return request<import("../types/api").JobStatusResponse>(`/analysis/${jobId}/status`);
}

export async function getSummary(jobId: string) {
  return request<import("../types/api").SummaryResponse>(`/analysis/${jobId}/summary`);
}

export async function getEntries(
  jobId: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const q = qs.toString();
  return request<import("../types/api").EntryListResponse>(
    `/analysis/${jobId}/entries${q ? `?${q}` : ""}`,
  );
}

export async function updateSettings(jobId: string, includeSarcasm: boolean) {
  return request<import("../types/api").JobSettingsResponse>(`/analysis/${jobId}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ include_sarcasm_in_aggregates: includeSarcasm }),
  });
}

export async function exportCsv(jobId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/analysis/${jobId}/export/csv`);
  if (!res.ok) throw new Error("CSV export failed");
  return res.blob();
}

export async function exportPdf(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/analysis/${jobId}/export/pdf`);
  if (res.status === 501) throw new Error("PDF export is not yet available");
  if (!res.ok) throw new Error("PDF export failed");
}

export function saveSessionMeta(jobId: string, meta: import("../types/api").SessionMeta) {
  sessionStorage.setItem(`sentiscan:${jobId}`, JSON.stringify(meta));
}

export function loadSessionMeta(jobId: string): import("../types/api").SessionMeta | null {
  const raw = sessionStorage.getItem(`sentiscan:${jobId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as import("../types/api").SessionMeta;
  } catch {
    return null;
  }
}
