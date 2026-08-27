from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MediKiosk API"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://medikiosk:medikiosk@localhost:5432/medikiosk"
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    staff_token_expire_minutes: int = 480
    kiosk_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    upload_dir: Path = Path("/data/uploads")
    max_upload_bytes: int = 10 * 1024 * 1024
    auto_create_schema: bool = False
    bootstrap_admin_email: str = "admin@medikiosk.local"
    bootstrap_admin_password: str = Field(min_length=12)

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
