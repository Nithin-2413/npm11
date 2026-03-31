from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent

class Settings(BaseSettings):
    # MongoDB
    mongo_url: str = Field(default="mongodb://localhost:27017", alias="MONGO_URL")
    db_name: str = Field(default="npm_db", alias="DB_NAME")

    # Groq LLM
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    llm_model: str = Field(default="llama-3.3-70b-versatile", alias="LLM_MODEL")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8001, alias="PORT")
    debug: bool = Field(default=True, alias="DEBUG")
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    # Browser
    headless: bool = Field(default=True, alias="HEADLESS")
    browser_timeout: int = Field(default=30000, alias="BROWSER_TIMEOUT")

    # Storage
    screenshot_dir: str = Field(default="./screenshots", alias="SCREENSHOT_DIR")
    upload_dir: str = Field(default="./uploads", alias="UPLOAD_DIR")

    class Config:
        env_file = str(ROOT_DIR / ".env")
        env_file_encoding = "utf-8"
        populate_by_name = True
        extra = "ignore"

    def get_cors_origins(self) -> List[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",")]


def get_settings() -> Settings:
    return Settings()
