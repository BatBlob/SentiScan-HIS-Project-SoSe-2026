from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "sentiscan"
    upload_dir: str = "../uploads"
    r_script_path: str = "../r-engine/run_analysis.R"
    r_executable: str = "Rscript"
    max_rows: int = 10000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    ml_model_url: str = "https://sentimentanalysisrhis-production.up.railway.app"
    r_plumber_url: str = "http://localhost:8080"
    ml_request_timeout: float = 120.0
    r_plumber_request_timeout: float = 300.0

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def r_script(self) -> Path:
        path = Path(self.r_script_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / path
        return path

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
