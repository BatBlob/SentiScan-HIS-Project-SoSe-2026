# Install R package dependencies for the Plumber pipeline (run once locally).
# Does not modify plumber.R or run_api.R — only installs packages and caches lexicons.

pkgs <- c(
  "plumber",
  "tidyverse",
  "tidytext",
  "textdata",
  "quanteda",
  "topicmodels",
  "sentimentr",
  "slam",
  "reshape2"
)

missing <- setdiff(pkgs, rownames(installed.packages()))
if (length(missing)) {
  message("Installing: ", paste(missing, collapse = ", "))
  install.packages(missing, repos = "https://cloud.r-project.org")
}

suppressPackageStartupMessages({
  library(tidytext)
  library(textdata)
})

cache_nrc_lexicon <- function() {
  nrc_dir <- lexicon_nrc(return_path = TRUE)
  dir.create(nrc_dir, recursive = TRUE, showWarnings = FALSE)

  rds_path <- file.path(nrc_dir, "NRCWordEmotion.rds")
  if (file.exists(rds_path)) {
    message("NRC lexicon already cached.")
    return(invisible(TRUE))
  }

  zip_path <- file.path(nrc_dir, "NRC-Emotion-Lexicon.zip")
  if (!file.exists(zip_path)) {
    message("Downloading NRC Emotion Lexicon zip...")
    utils::download.file(
      url = "http://saifmohammad.com/WebDocs/Lexicons/NRC-Emotion-Lexicon.zip",
      destfile = zip_path,
      mode = "wb",
      quiet = TRUE
    )
  }

  message("Extracting NRC lexicon...")
  utils::unzip(zip_path, exdir = nrc_dir)

  message("Processing NRC lexicon for tidytext...")
  invisible(lexicon_nrc(manual_download = TRUE))
}

message("Caching Bing sentiment lexicon...")
invisible(get_sentiments("bing"))

cache_nrc_lexicon()

message("Verifying NRC lexicon via tidytext...")
print(head(get_sentiments("nrc"), 3))

message("Done. Restart Plumber if it is running, then re-run analysis in SentiScan.")
message("Start API: .\\start-local.ps1")
