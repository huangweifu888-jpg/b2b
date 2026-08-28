import asyncio
import importlib
import logging
import os
import pkgutil
import socket
import traceback
from contextlib import asynccontextmanager
from datetime import datetime

from core.config import settings
from core.error_localization import localize_error_detail
from core.runtime_security import cors_allowed_origins
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter

# MODULE_IMPORTS_START
import models  # noqa: F401
from services.database import initialize_database, close_database
from services.mock_data import initialize_mock_data
from services.auth import initialize_admin_user
from services.platform_seed import initialize_platform_seed
from services.secret_controls import assert_runtime_secrets
from middlewares.request_security import RequestSecurityMiddleware
# MODULE_IMPORTS_END


def setup_logging():
    """Configure the logging system."""
    if os.environ.get("IS_LAMBDA") == "true":
        return

    # Create the logs directory
    log_dir = os.environ.get("LOG_DIR", "logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # Generate log filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"{log_dir}/app_{timestamp}.log"

    # Configure log format
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    # Configure the root logger
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            # File handler
            logging.FileHandler(log_file, encoding="utf-8"),
            # Console handler
            logging.StreamHandler(),
        ],
    )

    # Set log levels for specific modules
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)

    # Log configuration details
    logger = logging.getLogger(__name__)
    logger.info("=== Logging system initialized ===")
    logger.info(f"Log file: {log_file}")
    logger.info(f"Log level: {log_level_name}")
    logger.info(f"Timestamp: {timestamp}")


async def _local_listener_watchdog(logger: logging.Logger) -> None:
    """Exit a stuck local API process after its listening socket is lost.

    Windows can raise WinError 64 on an accepted local socket while Uvicorn
    keeps the Python process alive without a listener.  The development
    launcher supervises process exits, so this deliberate local-only exit lets
    it restore the API instead of leaving a misleading environment alert.
    """
    failed_checks = 0
    while True:
        await asyncio.sleep(1)
        try:
            with socket.create_connection(("127.0.0.1", 8000), timeout=0.5):
                pass
        except OSError:
            failed_checks += 1
            if failed_checks >= 3:
                logger.critical("Local API listener disappeared; exiting for launcher recovery")
                os._exit(75)
        else:
            failed_checks = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger(__name__)
    logger.info("=== Application startup initiated ===")

    # MODULE_STARTUP_START
    assert_runtime_secrets()
    await initialize_database()
    await initialize_mock_data()
    await initialize_admin_user()
    await initialize_platform_seed()
    # MODULE_STARTUP_END

    logger.info("=== Application startup completed successfully ===")
    listener_watchdog = (
        asyncio.create_task(_local_listener_watchdog(logger))
        if os.getenv("LOCAL_API_SOCKET_WATCHDOG") == "1"
        else None
    )
    try:
        yield
    finally:
        if listener_watchdog:
            listener_watchdog.cancel()
            try:
                await listener_watchdog
            except asyncio.CancelledError:
                pass
        # MODULE_SHUTDOWN_START
        await close_database()
        # MODULE_SHUTDOWN_END


app = FastAPI(
    title="TradePro B2B Platform API",
    description="Python + FastAPI backend for TradePro, designed to support a TypeScript-based headquarters, agency, and client frontend.",
    version="2.0.0",
    lifespan=lifespan,
)


# MODULE_MIDDLEWARE_START
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.add_middleware(RequestSecurityMiddleware)
# MODULE_MIDDLEWARE_END


# Auto-discover and include all routers from the local `routers` package
def include_routers_from_package(app: FastAPI, package_name: str = "routers") -> None:
    """Discover and include all APIRouter objects from a package.

    This scans the given package (and subpackages) for module-level variables that
    are instances of FastAPI's APIRouter. It supports "router", "admin_router" names.
    """

    logger = logging.getLogger(__name__)

    try:
        pkg = importlib.import_module(package_name)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.debug("Routers package '%s' not loaded: %s", package_name, exc)
        return

    discovered: int = 0
    for _finder, module_name, is_pkg in pkgutil.walk_packages(pkg.__path__, pkg.__name__ + "."):
        # Only import leaf modules; subpackages will be walked automatically
        if is_pkg:
            continue
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to import module '%s': %s", module_name, exc)
            continue

        # Check for router variable names: router and admin_router
        for attr_name in ("router", "admin_router"):
            if not hasattr(module, attr_name):
                continue

            attr = getattr(module, attr_name)

            if isinstance(attr, APIRouter):
                if attr.prefix.startswith("/api/v1/local-dev") and not settings.is_development_environment:
                    logger.info("Skipped local development router in non-development environment: %s.%s", module_name, attr_name)
                    continue
                app.include_router(attr)
                discovered += 1
                logger.info("Included router: %s.%s", module_name, attr_name)
            elif isinstance(attr, (list, tuple)):
                for idx, item in enumerate(attr):
                    if isinstance(item, APIRouter):
                        app.include_router(item)
                        discovered += 1
                        logger.info("Included router from list: %s.%s[%d]", module_name, attr_name, idx)

    if discovered == 0:
        logger.debug("No routers discovered in package '%s'", package_name)


# Setup logging before router discovery
setup_logging()
include_routers_from_package(app, "routers")


@app.exception_handler(HTTPException)
async def localized_http_exception_handler(request: Request, exc: HTTPException):
    """Keep backend validation and access notices Chinese in frontend toasts."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": localize_error_detail(exc.detail)},
        headers=exc.headers,
    )


# Add exception handler for unhandled exceptions.
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Log technical context but never expose an English traceback in the UI."""

    logger = logging.getLogger(__name__)
    error_message = str(exc)
    error_type = type(exc).__name__

    # Log full error details regardless of environment
    logger.error(f"Exception: {error_type}: {error_message}\n{traceback.format_exc()}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": localize_error_detail("Internal Server Error")},
    )


@app.get("/")
def root():
    return {"message": "TradePro B2B Platform API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/config")
def runtime_config():
    return {"API_BASE_URL": f"http://127.0.0.1:{settings.port}"}


def run_in_debug_mode(app: FastAPI):
    """Run the FastAPI app in debug mode with proper asyncio handling.

    This function handles the special case of running in a debugger (PyCharm, VS Code, etc.)
    where asyncio is patched, causing conflicts with uvicorn's asyncio_run.

    It loads environment variables from ../.env and uses asyncio.run() directly
    to avoid uvicorn's asyncio_run conflicts.

    Args:
        app: The FastAPI application instance
    """
    import asyncio
    from pathlib import Path

    import uvicorn
    from dotenv import load_dotenv

    # Load environment variables from ../.env in debug mode
    # If `LOCAL_DEBUG=true` is set, then MetaGPT's `ProjectBuilder.build()` will generate the `.env` file
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=True)
        logger = logging.getLogger(__name__)
        logger.info(f"Loaded environment variables from {env_path}")

    # In debug mode, use asyncio.run() directly to avoid uvicorn's asyncio_run conflicts
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=int(settings.port),
        log_level="info",
    )
    server = uvicorn.Server(config)
    asyncio.run(server.serve())


if __name__ == "__main__":
    import sys

    import uvicorn

    # Detect if running in debugger (PyCharm, VS Code, etc.)
    # Debuggers patch asyncio which conflicts with uvicorn's asyncio_run
    is_debugging = "pydevd" in sys.modules or (hasattr(sys, "gettrace") and sys.gettrace() is not None)

    if is_debugging:
        run_in_debug_mode(app)
    else:
        # Enable reload in normal mode
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=int(settings.port),
            reload_excludes=["**/*.py"],
        )
