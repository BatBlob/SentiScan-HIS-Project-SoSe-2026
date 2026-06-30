# Start the R Plumber API on port 8080 (matches backend R_PLUMBER_URL in .env).
# FastAPI uses port 8000 — do not run Plumber on 8000 at the same time.
$env:PORT = "8080"
Set-Location $PSScriptRoot
& "C:\Program Files\R\R-4.6.1\bin\Rscript.exe" run_api.R
