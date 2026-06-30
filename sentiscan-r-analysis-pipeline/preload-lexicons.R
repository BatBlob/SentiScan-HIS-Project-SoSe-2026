# Cache tidytext lexicons at Docker build time (plumber.R uses bing + nrc).
suppressPackageStartupMessages({
  library(tidytext)
  library(textdata)
})

nrc_dir <- lexicon_nrc(return_path = TRUE)
dir.create(nrc_dir, recursive = TRUE, showWarnings = FALSE)

zip_path <- file.path(nrc_dir, "NRC-Emotion-Lexicon.zip")
if (!file.exists(file.path(nrc_dir, "NRCWordEmotion.rds"))) {
  if (!file.exists(zip_path)) {
    utils::download.file(
      url = "http://saifmohammad.com/WebDocs/Lexicons/NRC-Emotion-Lexicon.zip",
      destfile = zip_path,
      mode = "wb",
      quiet = TRUE
    )
  }
  utils::unzip(zip_path, exdir = nrc_dir)
  invisible(lexicon_nrc(manual_download = TRUE))
}

invisible(get_sentiments("bing"))
invisible(get_sentiments("nrc"))
message("Sentiment lexicons cached.")
