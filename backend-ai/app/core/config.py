"""
Barsha Backend Configuration
Central configuration management with environment variables
Production-ready with security hardening
"""
import os
import secrets
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # ─────────────────────────────────────────────────────────────
    # APPLICATION
    # ─────────────────────────────────────────────────────────────
    APP_NAME: str = "Barsha E-Commerce API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production

    # ─────────────────────────────────────────────────────────────
    # SECURITY
    # ─────────────────────────────────────────────────────────────
    # IMPORTANT: Override SECRET_KEY in production via environment variable
    SECRET_KEY: str = "barsha-dev-key-CHANGE-IN-PRODUCTION-" + secrets.token_hex(16)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Session security
    SESSION_COOKIE_SECURE: bool = True  # HTTPS only in production
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "lax"

    # Rate limiting
    RATE_LIMIT_REQUESTS: int = 100  # requests per window
    RATE_LIMIT_WINDOW: int = 60  # seconds

    # Password policy
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True

    # ─────────────────────────────────────────────────────────────
    # DATABASE
    # ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./barsha.db"
    # PostgreSQL for production:
    # DATABASE_URL: str = "postgresql://user:password@localhost:5432/barsha"

    # Connection pool settings (for PostgreSQL)
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    # ─────────────────────────────────────────────────────────────
    # CORS (Cross-Origin Resource Sharing)
    # ─────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:4200",
        "http://localhost:8000",
        "https://barsha.com.tn",
        "https://www.barsha.com.tn"
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    CORS_MAX_AGE: int = 600  # 10 minutes

    # ─────────────────────────────────────────────────────────────
    # EXTERNAL APIS
    # ─────────────────────────────────────────────────────────────
    MEILISEARCH_URL: str = "https://cache-data.barsha.com.tn"
    MEILISEARCH_TOKEN: str = ""  # Set via environment
    BARSHA_API_URL: str = "https://main.barsha.com.tn"

    # ─────────────────────────────────────────────────────────────
    # AI CONFIGURATION
    # ─────────────────────────────────────────────────────────────
    OPENROUTER_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    AI_MODEL_TIMEOUT: int = 30  # seconds
    AI_MAX_TOKENS: int = 2048

    # ─────────────────────────────────────────────────────────────
    # PAYMENT (Click to Pay)
    # ─────────────────────────────────────────────────────────────
    CTP_MERCHANT_ID: str = ""
    CTP_API_KEY: str = ""
    CTP_SECRET_KEY: str = ""  # For webhook signature verification
    CTP_API_URL: str = "https://ctp.tn/api"
    CTP_SANDBOX_MODE: bool = True
    CTP_WEBHOOK_TOLERANCE: int = 300  # 5 minutes tolerance for webhook timestamps

    # ─────────────────────────────────────────────────────────────
    # APPLICATION URLS
    # ─────────────────────────────────────────────────────────────
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:4200"

    # ─────────────────────────────────────────────────────────────
    # ADMIN
    # ─────────────────────────────────────────────────────────────
    ADMIN_EMAIL: str = "admin@barsha.com.tn"
    # IMPORTANT: Set via environment variable in production
    ADMIN_PASSWORD: str = "ChangeThisPassword123!"

    # ─────────────────────────────────────────────────────────────
    # LOGGING
    # ─────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_FILE: Optional[str] = None  # Set to enable file logging

    # ─────────────────────────────────────────────────────────────
    # ANALYTICS
    # ─────────────────────────────────────────────────────────────
    ANALYTICS_ENABLED: bool = True
    ANALYTICS_BATCH_SIZE: int = 100
    ANALYTICS_FLUSH_INTERVAL: int = 60  # seconds

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v):
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of: {allowed}")
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
