from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    YOUTUBE_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    AI_PROVIDER: str = "auto"

    REDDIT_CLIENT_ID: str = ""
    REDDIT_CLIENT_SECRET: str = ""
    REDDIT_USER_AGENT: str = "creator-content-radar/0.1"

    TWITTER_API_KEY: str = ""
    TWITTER_API_SECRET: str = ""
    TWITTER_BEARER_TOKEN: str = ""

    TWITCH_CLIENT_ID: str = ""
    TWITCH_CLIENT_SECRET: str = ""

    TIKTOK_API_KEY: str = ""
    INSTAGRAM_API_KEY: str = ""

    SECRET_KEY: str = "dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"

    DATABASE_URL: str = "postgresql://localhost:5432/creator_radar"

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_PRO_MONTHLY: str = ""
    STRIPE_PRICE_BUSINESS_MONTHLY: str = ""
    STRIPE_PRICE_PRO_ANNUAL: str = ""
    STRIPE_PRICE_BUSINESS_ANNUAL: str = ""

    APP_URL: str = "http://localhost:8000"

    SENTRY_DSN: str = ""
    POSTHOG_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""

    @field_validator("YOUTUBE_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_BEARER_TOKEN", "TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET", "TIKTOK_API_KEY", "INSTAGRAM_API_KEY")
    @classmethod
    def strip_quotes(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith('"') and v.endswith('"'):
                v = v[1:-1]
            if v.startswith("'") and v.endswith("'"):
                v = v[1:-1]
        return v

    def validate_critical_keys(self) -> list[str]:
        missing = []
        if not self.YOUTUBE_API_KEY:
            missing.append("YOUTUBE_API_KEY")
        if not self.GEMINI_API_KEY:
            missing.append("GEMINI_API_KEY")
        if not self.SECRET_KEY or self.SECRET_KEY == "change-me-to-a-random-secret":
            missing.append("SECRET_KEY")
        return missing


settings = Settings()

_critical_missing = settings.validate_critical_keys()
if _critical_missing:
    import logging
    logging.warning(
        "Critical environment variables missing: %s. "
        "The app may not function correctly.",
        ", ".join(_critical_missing),
    )
