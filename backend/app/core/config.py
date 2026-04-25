from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    secret_key: str = "change-me"
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/problem_record"
    postgres_db: str = "problem_record"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_port: int = 5432
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    uploads_dir: str = "uploads"
    uploads_url_prefix: str = "/uploads"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def backend_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def uploads_dir_path(self) -> Path:
        return self.backend_root / self.uploads_dir


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
