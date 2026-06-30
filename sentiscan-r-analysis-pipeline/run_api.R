library(plumber)

port <- as.integer(Sys.getenv("PORT", "8080"))

pr("plumber.R") %>%
  pr_run(
    host = "0.0.0.0",
    port = port
  )
