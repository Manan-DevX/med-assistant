from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_text_model: str = "gemini-3.7-flash"
    gemini_tts_model: str = "gemini-3.1-flash-tts-preview"
    gemini_tts_voice: str = "Kore"

    database_url: str = "sqlite:///./eldercompanion.db"

    snooze_minutes: int = 10
    # A delivered reminder with no response after this long is logged as missed. Turn it down
    # to 1-2 minutes if you want to demo a missed dose without waiting.
    reminder_missed_after_minutes: int = 15

    jwt_secret: str = "change-me-to-a-random-string"
    jwt_expire_minutes: int = 1440
    jwt_algorithm: str = "HS256"

    demo_caregiver_email: str = "demo@eldercompanion.ai"
    demo_caregiver_password: str = "demo1234"
    demo_caregiver_name: str = "Demo Caregiver"
    demo_elder_name: str = "Grandma Rose"

    cors_origins: str = "http://localhost:3000"

    audio_upload_dir: Path = BASE_DIR / "audio_uploads"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
settings.audio_upload_dir.mkdir(parents=True, exist_ok=True)
