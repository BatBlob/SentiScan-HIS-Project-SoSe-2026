interface Props {
  rPipelineError?: string | null;
  moduleName: string;
}

export function PanelRPipelineNotice({ rPipelineError, moduleName }: Props) {
  const isUnreachable =
    !rPipelineError ||
    rPipelineError.includes("Could not reach") ||
    rPipelineError.includes("not configured");

  return (
    <div className="panel-notice panel-notice--r">
      <div className="panel-notice__icon">⚠️</div>
      <div className="panel-notice__body">
        <strong>{isUnreachable ? "R pipeline unavailable" : "R pipeline error"}</strong>
        <p>
          {isUnreachable ? (
            <>
              {moduleName} is provided by the R Plumber service. Ensure it is running on port 8080,
              then re-run the analysis.
            </>
          ) : (
            <>
              R Plumber was reachable but failed during analysis. {moduleName} could not be
              computed. Re-run analysis after fixing the issue below.
            </>
          )}
        </p>
        {rPipelineError && (
          <p className="panel-notice__detail">{rPipelineError}</p>
        )}
        {isUnreachable && (
          <>
            <code>cd sentiscan-r-analysis-pipeline; .\start-local.ps1</code>
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#666" }}>
              Or Docker: <code>docker compose up -d r-plumber</code>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
