# sentiment_api.R — Sentiment + ABSA + Intent REST API
# Run:  Rscript sentiment_api.R
# Port: set env var PORT (default 8000)
#
# Endpoints:
#   GET  /health    — status + model info
#   GET  /aspects   — list valid aspect categories
#   GET  /sample    — predict on built-in reviews (all models)
#   POST /predict   — overall sentiment  { "texts": ["...", "..."] }
#   POST /intent    — intent class       { "texts": ["...", "..."] }
#   POST /absa      — per-aspect ABSA    { "texts": ["...", "..."] }
#   POST /analyze   — intent + ABSA      { "texts": ["...", "..."] }
#   (all POST endpoints also accept singular: { "text": "..." })

Sys.setenv(LANG = "en_US.UTF-8", LC_ALL = "en_US.UTF-8")
try(Sys.setlocale("LC_CTYPE", "en_US.UTF-8"), silent = TRUE)

# ── Dependencies ───────────────────────────────────────────────────────────────
required <- c("plumber", "glmnet", "tm", "Matrix", "jsonlite")
for (pkg in required) {
  if (!requireNamespace(pkg, quietly = TRUE))
    install.packages(pkg, repos = "https://cloud.r-project.org")
}
library(plumber); library(glmnet); library(tm); library(Matrix); library(jsonlite)

# ── Load models ────────────────────────────────────────────────────────────────
load_model <- function(path) {
  if (!file.exists(path)) stop(sprintf("%s not found. Run model2.ipynb first.", path))
  readRDS(path)
}

sentiment_model  <- load_model("sentiment_model.rds")
absa_model       <- load_model("absa_model.rds")
absa_vocab       <- load_model("absa_vocab.rds")
intent_model     <- load_model("intent_model.rds")
intent_vocab     <- load_model("intent_vocab.rds")

# Vocabulary for the overall sentiment model (extracted from coefficients)
sentiment_vocab <- {
  v <- rownames(coef(sentiment_model, s = "lambda.min")[[1]])
  v[v != "(Intercept)"]
}

# Aspect categories expected by the ABSA model.
# The runtime detector maps common review words to the categories that were
# actually used during training or added as practical aliases.
aspect_keyword_map <- list(
  food = c("food", "dish", "meal", "cuisine", "taste", "flavor", "flavour", "portion", "dessert", "quality"),
  service = c("service", "staff", "server", "waiter", "waitress", "wait staff", "waitstaff", "host", "hostess", "kitchen staff"),
  menu = c("menu", "menus", "specials", "selection", "choices"),
  price = c("price", "prices", "priced", "cost", "costs", "value", "expensive", "cheap", "overpriced", "deal"),
  ambience = c("ambience", "ambiance", "atmosphere", "decor", "environment", "vibe"),
  place = c("place", "location", "area", "neighborhood", "neighbourhood", "spot", "restaurant"),
  drinks = c("drink", "drinks", "beverage", "beverages", "wine", "cocktail", "cocktails", "beer"),
  performance = c("performance", "show", "act", "acting", "presentation", "delivery"),
  sound = c("sound", "audio", "music", "volume", "hear", "heard", "loud", "quiet", "mic", "microphone"),
  stage = c("stage", "stage design", "set", "lighting", "production", "scenery", "backdrop"),
  interaction = c("interaction", "engagement", "engaging", "audience", "crowd", "participation"),
  cast = c("cast", "actor", "actors", "actress", "actresses", "performer", "performers", "role", "roles", "character", "characters"),
  direction = c("direction", "director", "directed", "staging", "blocking", "vision", "editing"),
  writing = c("writing", "script", "dialogue", "line", "lines", "plot", "story", "storyline", "narrative", "screenplay"),
  pacing = c("pacing", "pace", "slow", "fast-paced", "fast paced", "dragging", "rushed", "timing", "rhythm"),
  visuals = c("visual", "visuals", "look", "looks", "appearance", "cinematography", "effects", "design", "production design"),
  audience = c("audience", "crowd", "viewers", "spectators", "interaction", "engagement", "response", "reaction"),
  lectures = c("lecture", "lectures", "lecturer", "lecturers", "class", "classes", "teaching", "explains", "explained", "explaining", "professor", "instructor", "teacher", "course", "module", "seminar", "workshop", "tutorial"),
  workload = c("workload", "overload", "busy", "overwhelming", "too much work", "too many assignments", "heavy", "manageable", "pressure", "burden", "load"),
  assignments = c("assignment", "assignments", "homework", "project", "projects", "task", "tasks", "deadline", "deadlines", "due date", "due dates", "submission", "submissions", "deliverable", "deliverables"),
  materials = c("materials", "slides", "slide", "handout", "handouts", "reading", "readings", "textbook", "books", "course material", "course materials", "syllabus", "notes", "content", "resources"),
  platform = c("platform", "moodle", "lms", "online", "navigation", "interface", "remote", "virtual", "website", "portal", "dashboard", "login", "access"),
  feedback = c("feedback", "comments", "returned", "response", "responses", "marking", "graded", "grading back", "review", "reviews", "reply", "replies"),
  grading = c("grading", "grade", "grades", "criteria", "rubric", "rubrics", "fair", "unfair", "transparent", "weighting", "marks", "scoring", "assessed"),
  structure = c("structure", "organized", "organised", "logical", "well organized", "well organised", "flow", "sequence", "arranged", "layout", "format", "framework"),
  pace = c("pace", "paced", "fast", "slow", "rushed", "quickly", "time", "timing", "too fast", "too slow", "speed", "speedy", "sluggish"),
  support = c("helpful", "supportive", "support", "office hours", "tutorial", "tutorials", "assistant", "assistants", "guidance", "help", "helped", "accessible", "available", "availability"),
  examples = c("example", "examples", "practical example", "practical examples", "real-world", "real world", "dataset", "datasets", "use case", "use cases", "demo", "demos", "illustration", "illustrations"),
  assessment = c("assessment", "assessments", "exam", "exams", "midterm", "final", "quiz", "quizzes", "criteria", "weighting", "final project", "midterm project", "test", "tests"),
  discussion = c("discussion", "discussions", "interactive", "interactive exercises", "session", "sessions", "peer review", "group project", "group projects", "participation", "forum", "forums", "classroom"),
  professor = c("professor", "instructor", "teacher", "lecturer", "faculty", "ta", "teaching assistant", "tutorial assistant", "assistant"),
  remote = c("remote", "online", "virtual", "hybrid", "distance", "zoom", "teams", "webex", "setup", "configuration", "technical setup"),
  quality = c("quality", "standard", "freshness", "fresh", "stale", "well-made", "well made", "excellent quality", "poor quality"),
  presentation = c("presentation", "plating", "appearance", "served", "served up", "visual", "look", "looks", "packaging"),
  cleanliness = c("clean", "cleanliness", "dirty", "hygiene", "sanitary", "unsanitary", "spotless", "messy", "tidy"),
  atmosphere = c("atmosphere", "ambience", "ambiance", "mood", "environment", "vibe", "feel", "experience"),
  location = c("location", "location-wise", "neighborhood", "neighbourhood", "near", "far", "parking", "accessible", "accessibility"),
  speed = c("speed", "quickly", "slow", "fast", "waiting", "delay", "delayed", "prompt", "timely", "wait time"),
  miscellaneous = character(0)
)

known_aspects <- names(aspect_keyword_map)

cat(sprintf("sentiment_model  | lambda=%.6f | vocab=%d\n",
            sentiment_model$lambda.min, length(sentiment_vocab)))
cat(sprintf("absa_model       | lambda=%.6f | vocab=%d\n",
            absa_model$lambda.min,      length(absa_vocab)))
cat(sprintf("intent_model     | lambda=%.6f | vocab=%d\n",
            intent_model$lambda.min,    length(intent_vocab)))
cat(sprintf("known_aspects    | %s\n\n", paste(known_aspects, collapse = ", ")))

# ── Shared text cleaner ────────────────────────────────────────────────────────
clean_corpus <- function(texts) {
  corpus <- VCorpus(VectorSource(as.character(texts)))
  corpus <- tm_map(corpus, content_transformer(tolower))
  corpus <- tm_map(corpus, removePunctuation)
  corpus <- tm_map(corpus, removeNumbers)
  corpus <- tm_map(corpus, removeWords, stopwords("en"))
  tm_map(corpus, stripWhitespace)
}

to_sparse <- function(dtm) {
  Matrix::sparseMatrix(
    i = dtm$i, j = dtm$j, x = as.numeric(dtm$v),
    dims = dim(dtm), dimnames = dimnames(dtm)
  )
}

# ── Aspect auto-detection ──────────────────────────────────────────────────────
# Scans the text for aspect labels using whole-word matches only.
detect_aspects <- function(text) {
  t_raw <- tolower(as.character(text))
  matches_aspect <- function(patterns) {
    any(vapply(patterns, function(pattern) {
      grepl(paste0("\\b", gsub("\\s+", "\\\\s+", pattern), "\\b"), t_raw, perl = TRUE)
    }, logical(1), USE.NAMES = FALSE))
  }

  matched <- names(aspect_keyword_map)[vapply(aspect_keyword_map, matches_aspect, logical(1), USE.NAMES = FALSE)]
  matched <- setdiff(unique(matched), "miscellaneous")
  if (length(matched)) matched else "miscellaneous"
}

# ── Prediction helpers ─────────────────────────────────────────────────────────
predict_sentiment <- function(texts) {
  dtm  <- DocumentTermMatrix(clean_corpus(texts), control = list(dictionary = sentiment_vocab))
  x    <- to_sparse(dtm)
  cls  <- as.character(predict(sentiment_model, newx = x, s = "lambda.min", type = "class"))
  prob <- predict(sentiment_model, newx = x, s = "lambda.min", type = "response")
  lapply(seq_along(texts), function(i) {
    list(
      id        = i,
      text      = texts[[i]],
      sentiment = cls[i],
      probabilities = list(
        negative = round(prob[i, "negative", 1], 4),
        neutral  = round(prob[i, "neutral",  1], 4),
        positive = round(prob[i, "positive", 1], 4)
      )
    )
  })
}

predict_intent <- function(text) {
  t <- tolower(as.character(text))

  rule_intent <- NULL
  if (grepl("\\?", t) ||
      grepl("^(what|how|when|where|why|who|is |are |does |do |can |could |will |would )", t)) {
    rule_intent <- "inquiry"
  } else if (grepl("\\b(should|suggest|recommendation|please|consider|improve|wish|would be better|maybe|perhaps|add |include|hope|next time|could you|can you|would you|please add|please make|could use|need more|needs more|more office hours|more examples|more practical|please clarify|should be longer|would help|would be nice|it would help|recommend adding|needs to be|could be improved)\\b", t)) {
    rule_intent <- "suggestion"
  } else if (grepl("\\b(broken|defective|damaged|refund|return|failed|horrible|terrible|awful|worst|misleading|never again|rude|slow|poor|bad|expensive|overpriced|too high|disappointing|frustrating|annoying|unacceptable|dreadful|mediocre|lacking|confusing|unclear|overwhelming|unbalanced|issues|issue|too fast|too long|too many|not enough|poorly structured|hard to follow|disorganized|disorganised|late|delayed|inefficient|stressful)\\b", t)) {
    rule_intent <- "negative"
  } else if (grepl("\\b(amazing|excellent|perfect|fantastic|wonderful|love|recommend|best|awesome|outstanding|superb|great|happy|impressed|lovely|grand|captivating|delightful|impressive|brilliant|stunning|beautiful|fabulous|magnificent|exceptional|spectacular|masterful|charming|engaging|clear|helpful|informative|supportive|inspiring|valuable|solid|well organized|well organised|good learning experience|fascinating|transparent|valuable|useful|supporting|clearer|clear and concise)\\b", t)) {
    rule_intent <- "compliment"
  }

  dtm <- DocumentTermMatrix(clean_corpus(text), control = list(dictionary = intent_vocab))
  x   <- to_sparse(dtm)
  model_intent <- as.character(predict(intent_model, newx = x, s = "lambda.min", type = "class"))

  neutral_review <- grepl("\\b(okay|ok|average|decent|fine|manageable|reasonable|fair|neutral|mixed|nothing more|could use|could be|slightly|somewhat|at first|a bit|bit difficult|optional|still|not bad|solid)\\b", t) ||
    grepl("\\b(more examples|more office hours|more practical examples|better formatting|longer|clearer|could use more|need more|needs more)\\b", t)

  positive_review <- grepl("\\b(amazing|excellent|perfect|fantastic|wonderful|love|recommend|best|awesome|outstanding|superb|great|happy|impressed|lovely|grand|captivating|delightful|impressive|brilliant|stunning|beautiful|fabulous|magnificent|exceptional|spectacular|masterful|charming|engaging|clear|helpful|informative|supportive|inspiring|valuable|solid|transparent|fascinating|useful|usefully|well aligned|well structured|well organized|well organised)\\b", t) ||
    grepl("\\b(performance|presentation|show|experience|stage|sound|service|food|quality|atmosphere|cast|direction|writing|plot|story|music|visuals|audience|interaction|lecture|lectures|professor|instructor|class|assignments|materials|platform|feedback|grading|structure|support|examples|assessment|discussion)\\b", t)

  list(
    intent       = if (!is.null(rule_intent)) rule_intent else if (neutral_review && model_intent == "general") "neutral" else if (positive_review && model_intent == "general") "compliment" else model_intent,
    source       = if (!is.null(rule_intent)) "rule" else if (neutral_review && model_intent == "general") "rule+fallback" else if (positive_review && model_intent == "general") "rule+fallback" else "model",
    model_intent = model_intent
  )
}

# Splits text into clauses on sentence boundaries and contrastive conjunctions
# (but/however/although/...), so an aspect's cue-words can be scoped to the
# clause that actually mentions it instead of the whole review.
split_clauses <- function(text) {
  parts <- unlist(strsplit(
    as.character(text),
    "(?<=[.!?;])\\s+|\\s+\\b(?:but|however|although|though|while|yet)\\b\\s+",
    perl = TRUE
  ))
  parts[nzchar(trimws(parts))]
}

predict_absa <- function(text, aspects) {
  clauses <- split_clauses(text)
  whole_sentiment <- predict_sentiment(text)[[1]]

  aspect_results <- lapply(aspects, function(asp) {
    patterns <- aspect_keyword_map[[asp]]
    local_text <- text
    if (length(patterns)) {
      matched_clauses <- clauses[vapply(clauses, function(cl) {
        cl_low <- tolower(cl)
        any(vapply(patterns, function(p) {
          grepl(paste0("\\b", gsub("\\s+", "\\\\s+", p), "\\b"), cl_low, perl = TRUE)
        }, logical(1)))
      }, logical(1))]
      if (length(matched_clauses)) local_text <- paste(matched_clauses, collapse = " ")
    }
    t <- tolower(local_text)
    positive_cue <- grepl("\\b(amazing|excellent|perfect|fantastic|wonderful|love|recommend|best|awesome|outstanding|superb|great|happy|impressed|lovely|grand|good|nice)\\b", t)
    negative_cue <- grepl("\\b(broken|defective|damaged|refund|return|failed|horrible|terrible|awful|worst|misleading|never again|rude|slow|poor|bad|expensive|overpriced|too high)\\b", t)

    inp <- paste(text, paste0("ASPECT_", toupper(gsub(" ", "_", asp))))
    dtm <- DocumentTermMatrix(clean_corpus(inp), control = list(dictionary = absa_vocab))
    x   <- to_sparse(dtm)
    cls <- as.character(predict(absa_model, newx = x, s = "lambda.min", type = "class"))
    prb <- predict(absa_model, newx = x, s = "lambda.min", type = "response")
    prb_vec <- c(
      negative = as.numeric(prb[1, "negative", 1]),
      neutral  = as.numeric(prb[1, "neutral",  1]),
      positive = as.numeric(prb[1, "positive", 1])
    )

    if (positive_cue && !negative_cue) {
      prb_vec["positive"] <- max(prb_vec["positive"], prb_vec["negative"], prb_vec["neutral"]) + 0.05
      prb_vec <- prb_vec / sum(prb_vec)
      cls <- "positive"
    }

    list(
      aspect    = asp,
      sentiment = cls,
      probabilities = list(
        negative = round(prb_vec["negative"], 4),
        neutral  = round(prb_vec["neutral"],  4),
        positive = round(prb_vec["positive"], 4)
      )
    )
  })

  list(
    aspects             = aspect_results,
    model_sentiment     = whole_sentiment$sentiment,
    model_probabilities = whole_sentiment$probabilities
  )
}

# ── Sample data ────────────────────────────────────────────────────────────────
sample_reviews <- c(
  "The food was absolutely delicious but the service was shockingly rude.",
  "Great value for money! Arrived quickly and packaging was perfect.",
  "I wish the portion size was bigger. The taste is decent though.",
  "Terrible quality. Broke after one day. Complete waste of money.",
  "Does this come in a larger size? The quality looks great in the photos."
)

# ── Build API ──────────────────────────────────────────────────────────────────
pr <- plumber::pr() |>
  pr_set_parsers(c("json", "form", "text", "octet"))

# GET /aspects
pr$handle("GET", "/aspects", function() {
  list(count = length(known_aspects), aspects = known_aspects)
})

# GET /health
pr$handle("GET", "/health", function() {
  list(
    status  = "ok",
    models  = list(
      sentiment = list(lambda = round(sentiment_model$lambda.min, 6),
                       vocab  = length(sentiment_vocab)),
      absa      = list(lambda = round(absa_model$lambda.min, 6),
                       vocab  = length(absa_vocab)),
      intent    = list(lambda = round(intent_model$lambda.min, 6),
                       vocab  = length(intent_vocab))
    ),
    known_aspects = known_aspects,
    classes = list(
      sentiment = c("negative", "neutral", "positive"),
        intent    = c("negative", "neutral", "compliment", "general", "inquiry", "suggestion")
    )
  )
})

# GET /sample
pr$handle("GET", "/sample", function() {
  results <- lapply(sample_reviews, function(txt) {
    aspects  <- detect_aspects(txt)
    intent_r <- predict_intent(txt)
    absa_r   <- predict_absa(txt, aspects)
    list(
      text                = txt,
      detected_aspects    = aspects,
      sentiment           = predict_sentiment(txt)[[1]]$sentiment,
      intent              = intent_r$intent,
      intent_source       = intent_r$source,
      model_intent        = intent_r$model_intent,
      model_probabilities = absa_r$model_probabilities,
      absa                = absa_r$aspects
    )
  })
  list(count = length(results), predictions = results)
})

# Helper: resolve "text" or "texts" from request body into a character vector
parse_texts <- function(body, res) {
  raw <- body[["texts"]]
  if (is.null(raw)) raw <- body[["text"]]
  if (is.null(raw) || length(raw) == 0) {
    res$status <- 400
    return(list(error = "Request body must contain 'text' (string) or 'texts' (array)."))
  }
  as.character(unlist(raw))
}

# POST /predict  — overall sentiment
pr$handle("POST", "/predict", function(req, res) {
  tryCatch({
    body  <- if (!is.null(req$body)) req$body else jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    texts <- parse_texts(body, res)
    if (!is.character(texts)) return(texts)   # error list already set
    list(count = length(texts), predictions = predict_sentiment(texts))
  }, error = function(e) { res$status <- 500; list(error = conditionMessage(e)) })
})

# POST /intent  — intent classification
pr$handle("POST", "/intent", function(req, res) {
  tryCatch({
    body  <- if (!is.null(req$body)) req$body else jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    texts <- parse_texts(body, res)
    if (!is.character(texts)) return(texts)
    results <- lapply(texts, function(txt) {
      r <- predict_intent(txt)
      list(text = txt, intent = r$intent, source = r$source, model_intent = r$model_intent)
    })
    list(count = length(results), predictions = results)
  }, error = function(e) { res$status <- 500; list(error = conditionMessage(e)) })
})

# POST /absa  — per-aspect sentiment (aspects auto-detected)
pr$handle("POST", "/absa", function(req, res) {
  tryCatch({
    body  <- if (!is.null(req$body)) req$body else jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    texts <- parse_texts(body, res)
    if (!is.character(texts)) return(texts)
    results <- lapply(texts, function(txt) {
      aspects <- detect_aspects(txt)
      absa_r  <- predict_absa(txt, aspects)
      list(
        text                = txt,
        detected_aspects    = aspects,
        sentiment           = absa_r$model_sentiment,
        model_probabilities = absa_r$model_probabilities,
        absa                = absa_r$aspects
      )
    })
    list(count = length(results), predictions = results)
  }, error = function(e) { res$status <- 500; list(error = conditionMessage(e)) })
})

# POST /analyze  — intent + ABSA combined (aspects auto-detected)
pr$handle("POST", "/analyze", function(req, res) {
  tryCatch({
    body  <- if (!is.null(req$body)) req$body else jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
    texts <- parse_texts(body, res)
    if (!is.character(texts)) return(texts)
    results <- lapply(texts, function(txt) {
      aspects  <- detect_aspects(txt)
      intent_r <- predict_intent(txt)
      absa_r   <- predict_absa(txt, aspects)
      list(
        text                = txt,
        detected_aspects    = aspects,
        intent              = intent_r$intent,
        intent_source       = intent_r$source,
        model_intent        = intent_r$model_intent,
        sentiment           = absa_r$model_sentiment,
        model_probabilities = absa_r$model_probabilities,
        absa                = absa_r$aspects
      )
    })
    list(count = length(results), predictions = results)
  }, error = function(e) { res$status <- 500; list(error = conditionMessage(e)) })
})

# ── Start server ───────────────────────────────────────────────────────────────
port <- as.integer(Sys.getenv("PORT", "8000"))

cat(sprintf("API starting on http://0.0.0.0:%d\n\n", port))
cat("  GET  /health    — model info\n")
cat("  GET  /aspects   — valid aspect categories\n")
cat("  GET  /sample    — built-in demo\n")
cat("  POST /predict   — overall sentiment\n")
cat("  POST /intent    — intent classification\n")
cat("  POST /absa      — per-aspect sentiment (auto-detected aspects)\n")
cat("  POST /analyze   — intent + ABSA combined (auto-detected aspects)\n\n")

pr$run(host = "0.0.0.0", port = port, docs = FALSE)
