FROM rocker/verse:4.5.0

RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libfontconfig1-dev \
    libgit2-dev \
    libgsl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN Rscript -e "\
  options(repos = c(CRAN = 'https://packagemanager.posit.co/cran/__linux__/noble/latest')); \
  install.packages(c('plumber','tidytext','textdata','quanteda','topicmodels','sentimentr','slam','broom','reshape2'))"

WORKDIR /app
COPY preload-lexicons.R .
RUN Rscript preload-lexicons.R
COPY . .
EXPOSE 8000
CMD ["Rscript", "run_api.R"]
