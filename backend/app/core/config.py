from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "UDLAIoT API"
    api_prefix: str = "/api"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://nexiot:change-me@localhost:55478/nexiot"
    jwt_secret: str = "development-only-change-me"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    mqtt_host: str = "localhost"
    mqtt_port: int = 11883
    mqtt_admin_username: str = "nexiot-admin"
    mqtt_admin_password: str = "development-mqtt-admin-change-me"
    mqtt_backend_username: str = "nexiot-backend"
    mqtt_backend_password: str = "development-mqtt-backend-change-me"
    mqtt_public_host: str = "localhost"
    mqtt_public_port: int = 11883
    mqtt_public_websocket_port: int = 19001
    command_timeout_seconds: int = 10
    simulator_max_active_sessions: int = 12
    simulator_max_sessions_per_user: int = 4
    simulator_max_duration_seconds: int = 3600
    simulator_max_scenario_steps: int = 200
    simulator_max_firmware_source_kb: int = 256
    simulator_firmware_timeout_seconds: int = 45
    storage_path: str = "./storage"
    max_file_size_mb: int = 25
    max_video_size_mb: int = 100
    admin_username: str = "admin"
    admin_password: str = "Admin123!"
    admin_full_name: str = "Administrador UDLAIoT"
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:15173", "http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
