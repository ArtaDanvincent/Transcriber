from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/transcriber"
    STORAGE_PATH: str = "./storage"
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:3000"
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024
    WHISPER_MODEL: str = "base"

    class Config:
        env_file = ".env"


settings = Settings()
