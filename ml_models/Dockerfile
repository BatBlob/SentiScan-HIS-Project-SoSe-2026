FROM rocker/r-ver:4.3.3

ENV LANG=en_US.UTF-8 \
  LC_ALL=en_US.UTF-8

# System libraries required by tm / NLP packages
RUN apt-get update && apt-get install -y \
    libxml2-dev \
    libssl-dev \
    libcurl4-openssl-dev \
    zlib1g-dev \
    libsodium-dev \
  locales \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
  && locale-gen en_US.UTF-8

# Install R packages (cached as a layer unless this line changes)
RUN R -e "install.packages( \
    c('plumber', 'glmnet', 'tm', 'Matrix', 'jsonlite'), \
    repos = 'https://cloud.r-project.org', \
    Ncpus = 4 \
  )"

WORKDIR /app

# Copy model and API script
COPY sentiment_model.rds .
COPY absa_model.rds .
COPY absa_vocab.rds .
COPY intent_model.rds .
COPY intent_vocab.rds .
COPY sentiment_api.R .

EXPOSE 8000

CMD ["Rscript", "sentiment_api.R"]
