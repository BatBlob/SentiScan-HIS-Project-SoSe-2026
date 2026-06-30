# =============================================================================
# SentiScan — Plumber API
# POST /analyze   multipart/form-data, field name: "file"
# GET  /health
# =============================================================================

library(plumber)
library(tidyverse)
library(tidytext)
library(quanteda)
library(topicmodels)
library(sentimentr)

load_and_clean <- function(raw) {
  
  required <- c("raw_text", "label")
  
  if (!all(required %in% names(raw))) {
    stop("Request body must contain 'raw_text' and 'label' fields.")
  }
  
  raw %>%
    filter(!is.na(raw_text), nchar(raw_text) > 0) %>%
    mutate(
      doc_id = row_number(),
      doc_category = case_when(
        label == "pos" ~ "Positive",
        label == "neg" ~ "Negative",
        label == "neutral" ~ "Neutral",
        TRUE ~ "Unknown"
      ),
      cleaned_text = raw_text %>%
        str_to_lower() %>%
        str_replace_all("https?://[^\\s]+|www\\.[^\\s]+", " ") %>%
        str_replace_all("<[^>]+>", " ") %>%
        str_replace_all("[^a-z0-9 ]", " ") %>%
        str_squish(),
      word_count = str_count(cleaned_text, "\\S+")
    ) %>%
    filter(word_count >= 1)
}

compute_polarity <- function(df) {
  sentimentr_scores <- sentiment_by(df$cleaned_text) %>%
    select(element_id, ave_sentiment)
  bing_lex    <- get_sentiments("bing")
  bing_scores <- df %>%
    unnest_tokens(word, cleaned_text) %>%
    inner_join(bing_lex, by = "word") %>%
    count(doc_id, sentiment) %>%
    pivot_wider(names_from = sentiment, values_from = n, values_fill = 0) %>%
    mutate(bing_score = (positive - negative) / (positive + negative + 1))
  df %>%
    left_join(sentimentr_scores %>%
                rename(doc_id = element_id, sentimentr_score = ave_sentiment),
              by = "doc_id") %>%
    left_join(bing_scores %>% select(doc_id, bing_score), by = "doc_id") %>%
    mutate(
      sentimentr_score = replace_na(sentimentr_score, 0),
      bing_score       = replace_na(bing_score, 0),
      polarity_score   = 0.65 * sentimentr_score + 0.35 * bing_score,
      polarity_class   = case_when(
        polarity_score >  0.15 ~ "Very Positive",
        polarity_score >  0.02 ~ "Positive",
        polarity_score < -0.15 ~ "Very Negative",
        polarity_score < -0.02 ~ "Negative",
        TRUE                   ~ "Neutral"
      )
    )
}

compute_emotions <- function(df) {
  nrc_lex <- get_sentiments("nrc") %>%
    filter(!sentiment %in% c("positive", "negative"))
  df %>%
    unnest_tokens(word, cleaned_text) %>%
    inner_join(nrc_lex, by = "word") %>%
    count(sentiment) %>%
    mutate(pct = round(100 * n / sum(n), 1)) %>%
    arrange(desc(pct)) %>%
    select(emotion = sentiment, pct)
}

compute_topics <- function(df, k = 3) {
  corp  <- corpus(df, docid_field = "doc_id", text_field = "cleaned_text")
  toks  <- quanteda::tokens(corp, remove_punct = TRUE, remove_numbers = TRUE) %>%
    tokens_remove(stopwords("english")) %>%
    tokens_select(min_nchar = 3) %>%
    tokens_wordstem()
  dfm_q <- dfm(toks) %>% dfm_trim(min_termfreq = 1, min_docfreq = 1)
  dtm        <- convert(dfm_q, to = "topicmodels")
  row_totals <- slam::row_sums(dtm)
  dtm_clean  <- dtm[row_totals > 0, ]
  k_use <- min(k, nrow(dtm_clean) - 1)
  if (k_use < 2) return(list())
  lda_model <- LDA(dtm_clean, k = k_use, method = "Gibbs",
                   control = list(seed = 1234, burnin = 200, iter = 500, thin = 5))
  tidy(lda_model, matrix = "beta") %>%
    group_by(topic) %>%
    slice_max(beta, n = 8) %>%
    summarise(terms = list(term), .groups = "drop") %>%
    mutate(topic = as.integer(topic)) %>%
    { Map(function(t, ws) list(topic = t, terms = ws), .$topic, .$terms) }
}

run_analysis <- function(data) {
  df <- load_and_clean(data)
  df <- compute_polarity(df)

  summary_out <- list(
    documents      = nrow(df),
    avg_word_count = round(mean(df$word_count)),
    positive_pct   = round(100 * mean(df$polarity_class %in% c("Very Positive","Positive")), 1),
    negative_pct   = round(100 * mean(df$polarity_class %in% c("Very Negative","Negative")), 1)
  )
  polarity_dist <- df %>%
    count(polarity_class) %>%
    arrange(factor(polarity_class, levels = c("Very Positive","Positive","Neutral","Negative","Very Negative"))) %>%
    { Map(function(cl, n) list(class = cl, count = as.integer(n)), .$polarity_class, .$n) }
  top_words <- df %>%
    unnest_tokens(word, cleaned_text) %>%
    filter(!word %in% stop_words$word, nchar(word) > 2) %>%
    count(word, sort = TRUE) %>%
    slice_head(n = 30) %>%
    { Map(function(w, n) list(word = w, count = as.integer(n)), .$word, .$n) }
  top_bigrams <- df %>%
    unnest_tokens(bigram, cleaned_text, token = "ngrams", n = 2) %>%
    filter(!is.na(bigram)) %>%
    separate(bigram, c("w1", "w2"), sep = " ") %>%
    filter(!w1 %in% stop_words$word, !w2 %in% stop_words$word, nchar(w1) > 2, nchar(w2) > 2) %>%
    count(w1, w2, sort = TRUE) %>%
    slice_head(n = 20) %>%
    mutate(bigram = paste(w1, w2)) %>%
    { Map(function(bg, n) list(bigram = bg, count = as.integer(n)), .$bigram, .$n) }
  emotions_df  <- compute_emotions(df)
  emotions_out <- Map(function(e, p) list(emotion = e, pct = p), emotions_df$emotion, emotions_df$pct)
  topics_out   <- compute_topics(df, k = 3)

  list(
    summary               = summary_out,
    polarity_distribution = polarity_dist,
    top_words             = top_words,
    top_bigrams           = top_bigrams,
    emotions              = emotions_out,
    topics                = topics_out
  )
}

#* @apiTitle SentiScan
#* @apiDescription POST a two-column CSV (text, label — no header) as multipart/form-data field "file"

#* Analyze dataset
#* @post /analyze
#* @parser json
#* @serializer json list(auto_unbox = TRUE, null = "null")
function(req, res) {
  
  tryCatch({
    
    body <- req$body
    
    if (is.null(body$documents)) {
      res$status <- 400
      return(list(
        error = "JSON must contain a 'documents' array."
      ))
    }
    
    data <- tibble::as_tibble(body$documents)
    
    res$status <- 200
    run_analysis(data)
    
  }, error = function(e) {
    
    res$status <- 500
    
    list(
      error = conditionMessage(e)
    )
    
  })
  
}

#* Health check
#* @get /health
function() list(status = "ok")
