# =============================================================================
# SentiScan — Plumber API
# POST /analyze   JSON: {"documents": [{"raw_text": ..., "label": ...}, ...]}
# GET  /health
# =============================================================================

library(plumber)
library(tidyverse)
library(tidytext)
library(quanteda)
library(topicmodels)
library(sentimentr)

load_and_clean <- function(raw) {

  # Normalize to a tibble regardless of how jsonlite simplified the JSON
  if (is.data.frame(raw)) {
    docs <- tibble::as_tibble(raw)
  } else {
    if (length(raw) == 0) {
      stop("'documents' array is empty — no rows to analyze.")
    }
    docs <- purrr::map_dfr(raw, function(d) {
      tibble::tibble(
        raw_text = if (!is.null(d$raw_text)) as.character(d$raw_text) else NA_character_,
        label    = if (!is.null(d$label)) as.character(d$label) else NA_character_
      )
    })
  }

  required <- c("raw_text", "label")
  if (!all(required %in% names(docs))) {
    stop("Request body must contain 'raw_text' and 'label' fields.")
  }

  docs %>%
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

# ---- Corpus-level (aggregate) emotion breakdown — unchanged ----
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

# ---- NEW: per-document dominant emotion ----
# This is what was missing. The old code only ever produced ONE emotion
# breakdown for the whole corpus, so the UI's per-row "Emotion" column had
# nothing real to read from and ended up showing the same value for every row.
compute_doc_emotions <- function(df) {
  nrc_lex <- get_sentiments("nrc") %>%
    filter(!sentiment %in% c("positive", "negative"))

  doc_emotion <- df %>%
    select(doc_id, cleaned_text) %>%
    unnest_tokens(word, cleaned_text) %>%
    inner_join(nrc_lex, by = "word") %>%
    count(doc_id, sentiment) %>%
    group_by(doc_id) %>%
    slice_max(n, n = 1, with_ties = FALSE) %>%
    ungroup() %>%
    select(doc_id, emotion = sentiment)

  df %>%
    select(doc_id) %>%
    left_join(doc_emotion, by = "doc_id") %>%
    mutate(emotion = replace_na(emotion, "neutral"))
}

# ---- NEW: per-document confidence score ----
# Confidence = how strong/decisive the polarity signal is, blended with
# whether the two scoring methods (sentimentr vs bing) agree on direction.
# Strong magnitude + agreement -> high confidence.
# Weak magnitude or disagreement -> low confidence, flagged for review.
compute_confidence <- function(df) {
  df %>%
    mutate(
      agreement  = sign(sentimentr_score) == sign(bing_score),
      magnitude  = pmin(abs(polarity_score) / 0.3, 1),
      confidence = round(100 * (0.7 * magnitude + 0.3 * as.numeric(agreement))),
      confidence = pmax(pmin(confidence, 99), 5),
      confidence_flag = if_else(confidence < 60, "Low", "-")
    ) %>%
    select(doc_id, confidence, confidence_flag)
}

# ---- NEW: real keyword scoring (replaces the broken 0.95-for-everything panel) ----
# For each word, compare how often it shows up in positive-classified docs
# vs negative-classified docs (by polarity_class, the model's own output).
# score ranges roughly -1 (purely negative-associated) to +1 (purely
# positive-associated), so words actually get differentiated, and negative
# keywords can populate since they're computed symmetrically with positive.
compute_keyword_scores <- function(df, top_n = 15, min_support = 5) {
  n_pos <- sum(df$polarity_class %in% c("Very Positive", "Positive"))
  n_neg <- sum(df$polarity_class %in% c("Very Negative", "Negative"))

  word_doc <- df %>%
    select(doc_id, polarity_class, cleaned_text) %>%
    unnest_tokens(word, cleaned_text) %>%
    filter(
      !word %in% stop_words$word,
      nchar(word) > 2,
      str_detect(word, "^[a-z]+$")   # drops dashes/punctuation tokens like "—"
    ) %>%
    distinct(doc_id, polarity_class, word)

  word_stats <- word_doc %>%
    mutate(
      is_pos = polarity_class %in% c("Very Positive", "Positive"),
      is_neg = polarity_class %in% c("Very Negative", "Negative")
    ) %>%
    group_by(word) %>%
    summarise(
      pos_docs = sum(is_pos),
      neg_docs = sum(is_neg),
      total    = n(),
      .groups  = "drop"
    ) %>%
    filter(total >= min_support) %>%
    mutate(
      pos_rate = pos_docs / max(n_pos, 1),
      neg_rate = neg_docs / max(n_neg, 1),
      score    = round((pos_rate - neg_rate) / (pos_rate + neg_rate + 1e-6), 2)
    )

  positive_kw <- word_stats %>%
    filter(score > 0) %>%
    arrange(desc(score), desc(total)) %>%
    slice_head(n = top_n)

  negative_kw <- word_stats %>%
    filter(score < 0) %>%
    arrange(score, desc(total)) %>%
    slice_head(n = top_n)

  list(
    positive = Map(function(w, s) list(word = w, score = s),
                    positive_kw$word, positive_kw$score),
    negative = Map(function(w, s) list(word = w, score = s),
                    negative_kw$word, negative_kw$score)
  )
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

  doc_emotions   <- compute_doc_emotions(df)
  doc_confidence <- compute_confidence(df)

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
  keyword_scores_out <- compute_keyword_scores(df)

  # Per-document rows — this is what the Confidence Scoring table actually needs
  documents_out <- df %>%
    left_join(doc_emotions, by = "doc_id") %>%
    left_join(doc_confidence, by = "doc_id") %>%
    select(doc_id, raw_text, sentiment = polarity_class, emotion, confidence, confidence_flag) %>%
    purrr::pmap(function(doc_id, raw_text, sentiment, emotion, confidence, confidence_flag) {
      list(
        doc_id     = doc_id,
        text       = raw_text,
        sentiment  = sentiment,
        emotion    = emotion,
        confidence = confidence,
        flag       = confidence_flag
      )
    })

  list(
    summary               = summary_out,
    polarity_distribution = polarity_dist,
    top_words             = top_words,
    top_bigrams           = top_bigrams,
    emotions              = emotions_out,
    topics                = topics_out,
    keyword_scores        = keyword_scores_out,
    documents             = documents_out
  )
}

#* @apiTitle SentiScan
#* @apiDescription POST {"documents": [{"raw_text": ..., "label": ...}, ...]} as JSON

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

    res$status <- 200
    run_analysis(body$documents)

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