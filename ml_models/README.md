# HIS — Sentiment Analysis Models

Two notebooks build the models that power `sentiment_api.R`.

---

## model.ipynb — Overall Sentiment Classification

### Goal
Classify any free-text review as **negative / neutral / positive**.

### Dataset
| Property | Value |
|---|---|
| Source | `Reviews.csv` (Amazon Fine Food Reviews) |
| Total rows | 568,454 |
| Columns | 10 (Id, ProductId, UserId, Score, Summary, Text, …) |
| Label source | `Score` column (1–2 → negative, 3 → neutral, 4–5 → positive) |

**Class distribution (full dataset)**

| Class | Count |
|---|---|
| Positive | 443,777 |
| Negative | 82,037 |
| Neutral | 42,640 |

### Training setup
| Setting | Value |
|---|---|
| Sample used | 100,000 rows (random, `set.seed(42)`) |
| Train / test split | 80,000 / 20,000 |
| Text features | Bag-of-words (raw TF), min word length 3, min doc frequency 5 |
| Vocabulary size | 18,582 terms |
| Model | `cv.glmnet` — multinomial logistic regression, 5-fold CV |
| Best lambda | 0.000955 |

### Results

#### Full test set (20,000 rows)
| Metric | Value |
|---|---|
| Accuracy | **0.8549** |
| Macro F1 | 0.6196 |
| Weighted F1 | 0.8360 |

**Per-class (full test set)**

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Negative | 0.7389 | 0.6083 | 0.6673 | 2,959 |
| Neutral | 0.4982 | 0.1834 | 0.2682 | 1,510 |
| Positive | 0.8832 | 0.9672 | 0.9233 | 15,531 |

#### Model comparison (500-row subsample — same rows for all three)
| Model | Accuracy | Macro F1 | Weighted F1 |
|---|---|---|---|
| **Logistic Regression** | **0.8800** | **0.6438** | **0.8676** |
| RoBERTa (`cardiffnlp/twitter-roberta-base-sentiment-latest`) | 0.8220 | 0.6301 | 0.8412 |
| DistilBERT (`lxyuan/distilbert-base-multilingual-cased-sentiments-student`) | 0.7600 | 0.5374 | 0.7700 |

> Transformer models are applied **zero-shot** (no fine-tuning on Reviews.csv). Fine-tuning on in-domain data would push their scores above the LR baseline.

### Output
| File | Description |
|---|---|
| `sentiment_model.rds` | Trained `cv.glmnet` object |

---

## model2.ipynb — Aspect-Based Sentiment Analysis & Intent Classification

### Goal
- **ABSA** — given a sentence and an aspect (e.g. *food*, *service*), predict sentiment for that specific aspect
- **Intent** — classify the intent of the whole review (complaint / compliment / inquiry / suggestion / general)

### Datasets
| Dataset | HuggingFace slug | Purpose |
|---|---|---|
| MAMS | `NEUDM/mams` | Supervised ABSA training (aspect-category + polarity) |
| M-ABSA | `Multilingual-NLP/M-ABSA` | Cross-domain / multilingual evaluation |

**MAMS splits**

| Split | Rows |
|---|---|
| Train | 7,446 |
| Validation | 900 |
| Test | 900 |
| **Total (combined)** | **9,246** |

After parsing and expanding to one row per (sentence, aspect) pair and dropping the `conflict` class:

| Split | Rows |
|---|---|
| ABSA train | 18,180 |
| ABSA test | 4,546 |

**Polarity distribution (train set)**

| Polarity | Count |
|---|---|
| Neutral | 8,090 |
| Positive | 5,272 |
| Negative | 4,818 |

### Training setup — ABSA model
| Setting | Value |
|---|---|
| Input | Review text + `ASPECT_<CATEGORY>` suffix |
| Text features | Bag-of-words, min word length 3, min doc frequency 2 |
| Vocabulary size | 9,227 terms |
| Model | `cv.glmnet` multinomial, 5-fold CV |
| Best lambda | 0.005485 |
| CV error | 0.3805 |

### Results — ABSA model (4,546-row test set)
| Metric | Value |
|---|---|
| Accuracy | **0.6219** |
| Macro F1 | 0.5947 |
| Weighted F1 | 0.6116 |

**Per-class**

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Negative | 0.6703 | 0.5547 | 0.6071 | 1,206 |
| Neutral | 0.6368 | 0.7976 | 0.7082 | 2,016 |
| Positive | 0.5376 | 0.4154 | 0.4687 | 1,324 |

### Training setup — Intent model
| Setting | Value |
|---|---|
| Labels | Heuristic rules applied to MAMS sentences (polarity + keyword patterns) |
| Input | Raw sentence text (no aspect suffix) |
| Model | `cv.glmnet` multinomial, 5-fold CV |
| Train / test split | 80 / 20 of all 22,726 parsed rows |

**Intent label rules**

| Intent | Rule |
|---|---|
| `complaint` | Negative polarity or strong negative keywords (broken, refund, worst…) |
| `compliment` | Positive polarity + praise keywords (amazing, excellent, recommend…) |
| `inquiry` | Question mark or interrogative opener (what, how, does, can…) |
| `suggestion` | Improvement keywords (suggest, wish, improve, hope, next time…) |
| `general` | Everything else |

### Outputs
| File | Description |
|---|---|
| `absa_model.rds` | ABSA `cv.glmnet` classifier |
| `absa_vocab.rds` | 9,227-term vocabulary for ABSA model |
| `intent_model.rds` | Intent `cv.glmnet` classifier |
| `intent_vocab.rds` | Vocabulary for intent model |

---

## API — sentiment_api.R

All four models are served by `sentiment_api.R` via [plumber](https://www.rplumber.io/).

```bash
Rscript sentiment_api.R           # default port 8000
PORT=9090 Rscript sentiment_api.R
```

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/health` | GET | — | Model info + lambda values |
| `/sample` | GET | — | Predictions on 5 built-in reviews |
| `/predict` | POST | `{"texts": [...]}` | Overall sentiment + probabilities |
| `/intent` | POST | `{"text": "..."}` | Intent class |
| `/absa` | POST | `{"text": "...", "aspects": [...]}` | Per-aspect sentiment + probabilities |
| `/analyze` | POST | `{"text": "...", "aspects": [...]}` | Intent + per-aspect ABSA |

---

## File map

```
HIS Project/
├── model.ipynb          # Overall sentiment: data → train → evaluate
├── model2.ipynb         # ABSA + Intent: data → train → evaluate
├── sentiment_api.R      # Plumber REST API serving all models
├── Reviews.csv          # Amazon Fine Food Reviews (required by model.ipynb)
├── sentiment_model.rds  # Output of model.ipynb
├── absa_model.rds       # Output of model2.ipynb
├── absa_vocab.rds       # Output of model2.ipynb
├── intent_model.rds     # Output of model2.ipynb
└── intent_vocab.rds     # Output of model2.ipynb
```

## Run order

```
1. model.ipynb      →  produces sentiment_model.rds
2. model2.ipynb     →  produces absa_model.rds, absa_vocab.rds,
                        intent_model.rds, intent_vocab.rds
3. sentiment_api.R  →  loads all .rds files and starts the API
```
