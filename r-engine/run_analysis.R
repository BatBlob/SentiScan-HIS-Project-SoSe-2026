#!/usr/bin/env Rscript

# SentiScan analysis entry point (stub for demo).
# CLI: Rscript run_analysis.R --input <csv> --config <json> --output <json>

args <- commandArgs(trailingOnly = TRUE)

get_arg <- function(name, default = NULL) {
  idx <- which(args == paste0("--", name))
  if (length(idx) == 0) return(default)
  if (idx == length(args)) return(default)
  args[[idx + 1]]
}

input_path <- get_arg("input")
config_path <- get_arg("config")
output_path <- get_arg("output")

if (is.null(input_path) || is.null(config_path) || is.null(output_path)) {
  stop("Usage: Rscript run_analysis.R --input <csv> --config <json> --output <json>")
}

file_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
script_dir <- if (length(file_arg)) {
  dirname(normalizePath(sub("^--file=", "", file_arg)))
} else {
  "."
}
stub_path <- file.path(script_dir, "stub_results.json")

if (!file.exists(stub_path)) {
  stop(paste("Stub results not found:", stub_path))
}

config <- jsonlite::fromJSON(config_path, simplifyVector = TRUE)
input_data <- read.csv(input_path, stringsAsFactors = FALSE, fileEncoding = "UTF-8-BOM")
row_count <- nrow(input_data)

stub <- jsonlite::fromJSON(stub_path, simplifyVector = FALSE)
template_entries <- stub$entries
aggregates <- stub$aggregates

polarities <- c("Very Positive", "Positive", "Neutral", "Negative", "Very Negative")
intents <- c("complaint", "suggestion", "inquiry", "compliment", "statement")
emotions <- list(
  happiness = c(0.7, 0.5, 0.3, 0.2, 0.1),
  sadness = c(0.05, 0.1, 0.15, 0.3, 0.4),
  anger = c(0.05, 0.1, 0.1, 0.25, 0.35),
  fear = c(0.05, 0.05, 0.1, 0.1, 0.15),
  surprise = c(0.1, 0.15, 0.2, 0.1, 0.05),
  disgust = c(0.05, 0.1, 0.15, 0.15, 0.2)
)

entries <- vector("list", row_count)
for (i in seq_len(row_count)) {
  template <- template_entries[[((i - 1) %% length(template_entries)) + 1]]
  p_idx <- ((i - 1) %% length(polarities)) + 1
  i_idx <- ((i - 1) %% length(intents)) + 1
  sarcasm <- i %% 7 == 0

  entry <- list(
    row_index = i - 1,
    polarity = polarities[[p_idx]],
    polarity_confidence = round(runif(1, 0.62, 0.95), 2),
    emotions = list(
      happiness = emotions$happiness[[p_idx]],
      sadness = emotions$sadness[[p_idx]],
      anger = emotions$anger[[p_idx]],
      fear = emotions$fear[[p_idx]],
      surprise = emotions$surprise[[p_idx]],
      disgust = emotions$disgust[[p_idx]]
    ),
    intent = intents[[i_idx]],
    sarcasm_flag = sarcasm,
    sarcasm_confidence = if (sarcasm) round(runif(1, 0.7, 0.92), 2) else round(runif(1, 0.05, 0.25), 2),
    aspects = template$aspects,
    topics = template$topics
  )
  entries[[i]] <- entry
}

sarcasm_count <- sum(vapply(entries, function(e) isTRUE(e$sarcasm_flag), logical(1)))

result <- list(
  entries = entries,
  aggregates = aggregates
)
result$aggregates$sarcasm_count <- sarcasm_count

jsonlite::write_json(result, output_path, auto_unbox = TRUE, pretty = TRUE)
