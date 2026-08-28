import logging
import os
from typing import Any

from pydantic_settings import BaseSettings
from core.path_registry import get_path_registry

logger = logging.getLogger(__name__)


def _default_database_url() -> str:
    active_database = get_path_registry().active_database_file
    return f"sqlite:///{active_database.as_posix()}"


class Settings(BaseSettings):
    # Application
    app_name: str = "TradePro B2B Platform"
    debug: bool = False
    version: str = "1.0.0"
    environment: str = "production"
    app_component: str = "api"
    deployment_id: str = "shared-stamp-a"
    public_base_url: str = ""
    cors_allowed_origins: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    database_url: str = _default_database_url()
    database_schema_mode: str = ""
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    redis_url: str = "redis://127.0.0.1:6379/0"
    content_download_secret: str = ""
    asset_storage_root: str = ""
    asset_storage_uri: str = ""
    backup_target: str = ""
    backup_schedule_id: str = ""
    restore_drill_reference: str = ""
    rate_limit_backend: str = ""
    download_url_ttl_seconds: int = 300
    require_mfa_for_privileged_roles: bool = False
    mfa_privileged_roles: str = "admin,headquarters_administrator,technical_operations,security_owner"

    @property
    def is_development_environment(self) -> bool:
        """Whether this process is explicitly a local/development/test process."""
        environment = os.getenv("ENVIRONMENT", self.environment).strip().lower()
        return environment in {"dev", "development", "local", "test", "testing"}

    @property
    def should_bootstrap_database_schema(self) -> bool:
        """Allow metadata-driven schema creation only for explicit local development.

        Production-like processes must receive their schema through Alembic before
        the application starts. The environment lookup is deliberately dynamic so
        launch scripts and tests can set it before the database is initialized.
        """
        configured_mode = os.getenv("DATABASE_SCHEMA_MODE", self.database_schema_mode).strip().lower()
        mode = configured_mode or ("bootstrap" if self.is_development_environment else "migrate")
        if mode not in {"bootstrap", "migrate"}:
            raise ValueError("DATABASE_SCHEMA_MODE must be either 'bootstrap' or 'migrate'")
        if mode == "bootstrap" and not self.is_development_environment:
            raise ValueError("DATABASE_SCHEMA_MODE=bootstrap is allowed only in dev/local/test environments")
        return mode == "bootstrap"

    # Optional AI defaults for local backend use
    app_ai_base_url: str = ""
    app_ai_key: str = ""
    openai_api_key: str = ""
    codex_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"

    # AWS Lambda Configuration
    is_lambda: bool = False
    lambda_function_name: str = "fastapi-backend"
    aws_region: str = "us-east-1"

    @property
    def backend_url(self) -> str:
        """Generate backend URL from host and port."""
        if self.is_lambda:
            # In Lambda environment, return the API Gateway URL
            return os.environ.get(
                "PYTHON_BACKEND_URL", f"https://{self.lambda_function_name}.execute-api.{self.aws_region}.amazonaws.com"
            )
        else:
            # Use localhost for external callbacks instead of 0.0.0.0
            display_host = "127.0.0.1" if self.host == "0.0.0.0" else self.host
            return os.environ.get("PYTHON_BACKEND_URL", f"http://{display_host}:{self.port}")

    class Config:
        case_sensitive = False
        extra = "ignore"

    def __getattr__(self, name: str) -> Any:
        """
        Dynamically read attributes from environment variables.
        For example: settings.opapi_key reads from OPAPI_KEY environment variable.

        Args:
            name: Attribute name (e.g., 'opapi_key')

        Returns:
            Value from environment variable

        Raises:
            AttributeError: If attribute doesn't exist and not found in environment variables
        """
        # Convert attribute name to environment variable name (snake_case -> UPPER_CASE)
        env_var_name = name.upper()

        # Check if environment variable exists
        if env_var_name in os.environ:
            value = os.environ[env_var_name]
            # Cache the value in instance dict to avoid repeated lookups
            self.__dict__[name] = value
            logger.debug(f"Read dynamic attribute {name} from environment variable {env_var_name}")
            return value

        # If not found, raise AttributeError to maintain normal Python behavior
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")


# Global settings instance
settings = Settings()
