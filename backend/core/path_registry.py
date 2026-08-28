from __future__ import annotations

import json
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class PathRegistry:
    codex_root: Path
    project_root: Path
    app_root: Path
    backend_root: Path
    frontend_root: Path
    hq_program_root: Path
    agency_program_root: Path
    client_program_root: Path
    site_program_root: Path
    backup_root: Path
    program_backup_root: Path
    site_backup_root: Path
    database_root: Path
    hq_db_root: Path
    agency_db_root: Path
    client_db_root: Path
    site_db_root: Path
    active_database_file: Path
    website_root: Path
    misc_files_root: Path
    website_style_root: Path
    asset_resource_root: Path
    local_env_script: Path
    restart_local_env_script: Path
    path_config_file: Path
    root_notes: dict[str, dict[str, str]]
    backup_notes: dict[str, dict[str, str]]

    @property
    def deployment_role_definitions_root(self) -> Path:
        """Role packaging rules always follow the active application root."""
        return self.app_root / "deployment" / "role-definitions"

    @property
    def global_release_flow_file(self) -> Path:
        """The six-step release flow always follows the active application root."""
        return self.app_root / "deployment" / "common" / "global-release-flow.yaml"

    @property
    def deployment_profiles_root(self) -> Path:
        return self.app_root / "deployment" / "profiles"

    @property
    def module_architecture_file(self) -> Path:
        """Portable progressive-module contract owned by the active source root."""
        return self.app_root / "modules" / "module-architecture.json"


ROOT_HELPER_FILE_HINTS: dict[str, dict[str, str]] = {
    "00-platform-source": {
        "status": "keep",
        "summary": "平台唯一开发源码与部署规则目录。",
        "reason": "总部端、代理源、客户源及共享能力只在这里开发；所有角色发布成品必须由这里的规则生成。",
    },
    "01-hq-source-control": {
        "status": "keep",
        "summary": "总部与双源控制角色交付区。",
        "reason": "保存按 01 角色规则生成的总部端、代理源、客户源控制面版本成品，不作为第二套开发源码。",
    },
    "02-agency-runtime": {
        "status": "keep",
        "summary": "多代理与多级代理运行角色交付区。",
        "reason": "保存按 02 角色规则生成的代理端运行版本成品，供对应服务器部署和回滚。",
    },
    "03-client-plan-runtime": {
        "status": "keep",
        "summary": "多客户端与客户端多计划运行角色交付区。",
        "reason": "保存按 03 角色规则生成的客户端及计划运行版本成品，计划数据不复制整套源码。",
    },
    "04-content-worker": {
        "status": "keep",
        "summary": "素材、构建、发布与异步任务角色交付区。",
        "reason": "保存按 04 角色规则生成的工作进程版本成品，用于素材处理、网站构建和后台任务部署。",
    },
    "05-edge-observability": {
        "status": "keep",
        "summary": "公网入口、HTTPS 与观测角色交付区。",
        "reason": "保存按 05 角色规则生成的网关、域名、限流、日志、监控和告警配置成品。",
    },
    "06-data-services": {
        "status": "keep",
        "summary": "数据库、缓存与对象存储角色交付区。",
        "reason": "保存按 06 角色规则生成的数据服务配置和迁移成品；真实生产数据与程序发布包保持分离。",
    },
    "07-backup-disaster-recovery": {
        "status": "keep",
        "summary": "异地备份、恢复演练与灾备角色交付区。",
        "reason": "保存按 07 角色规则生成的备份策略、恢复手册和演练证据；正式备份必须位于不同故障域。",
    },
    "local-data": {
        "status": "keep",
        "summary": "本地沙盘可变数据目录。",
        "reason": "保存本地数据库、上传素材、对象数据和网站预览数据；仅用于开发恢复，不打入服务器发布包。",
    },
    "local-runtime": {
        "status": "keep",
        "summary": "本机可重建运行环境目录。",
        "reason": "保存便携 Node、Python、依赖、启动脚本、日志和进程状态；可重建且不随生产程序上传。",
    },
    "README.md": {
        "status": "keep",
        "summary": "软件根目录总说明与操作入口。",
        "reason": "记录换电脑、本地启动、00 唯一源码、01–07 角色职责及发布恢复边界，必须随目录规划同步维护。",
    },
    "check-b2b-local.ps1": {
        "status": "keep",
        "summary": "本地环境检查脚本。",
        "reason": "用于快速确认 3003 前端、8000 后端和 3004 网站预览是否正常响应。",
    },
    "start-b2b-local.ps1": {
        "status": "keep",
        "summary": "本地环境启动脚本。",
        "reason": "用于手动启动当前开发环境，右侧沙盘空白时也可以直接拉起服务。",
    },
    "stop-b2b-local.ps1": {
        "status": "keep",
        "summary": "本地环境停止脚本。",
        "reason": "用于释放 3003、8000、3004 端口，避免残留进程影响重启。",
    },
    ".pnpm-store": {
        "status": "keep",
        "summary": "pnpm 依赖缓存目录。",
        "reason": "删除后不影响源码，但下次安装依赖时会重新下载。",
    },
    "b2b": {
        "status": "keep",
        "summary": "当前主工程目录。",
        "reason": "总部、代理、客户端共用的正式开发目录。",
    },
    "beifen": {
        "status": "keep",
        "summary": "统一备份目录。",
        "reason": "程序备份和网站备份都统一放在这里。",
    },
    "wz": {
        "status": "keep",
        "summary": "独立计划网站目录。",
        "reason": "每个独立计划的站点文件统一输出到这里，可直接上传到服务器。",
    },
    "wzfg": {
        "status": "keep",
        "summary": "网站风格模板目录。",
        "reason": "用于集中存放网站风格、主题和样式资产。",
    },
    "zcwj": {
        "status": "keep",
        "summary": "其他文件目录。",
        "reason": "不属于软件运行但仍需要直接使用的资料统一放在这里。",
    },
    "sczy": {
        "status": "keep",
        "summary": "素材资源目录。",
        "reason": "上传的图片、视频等软件素材统一存放在这里。",
    },
    "sjk": {
        "status": "keep",
        "summary": "数据库总目录。",
        "reason": "总部、代理、客户端、独立计划的数据库目录统一放在这里。",
    },
}

RELEASE_DIR_HINTS: dict[str, dict[str, str]] = {
    ".atoms": {
        "status": "keep",
        "summary": "阶段说明目录。",
        "reason": "用于保存结构说明、进度记录和阶段性文档。",
    },
    "app": {
        "status": "keep",
        "summary": "历史应用目录。",
        "reason": "如仍有旧版引用可暂留，否则后续可逐步清理。",
    },
    "docs": {
        "status": "keep",
        "summary": "项目文档目录。",
        "reason": "用于保存平台方案、说明文档和部署资料。",
    },
    "uploads": {
        "status": "keep",
        "summary": "上传资源目录。",
        "reason": "用于保存演示素材、上传文件和测试资源。",
    },
    "backend": {
        "status": "keep",
        "summary": "后端目录。",
        "reason": "FastAPI 后端主目录，负责真实数据、权限、发布和备份链路。",
    },
    "frontend": {
        "status": "keep",
        "summary": "前端目录。",
        "reason": "React + TypeScript 前端主目录，负责总部、代理和客户端界面。",
    },
    "logs": {
        "status": "keep",
        "summary": "日志目录。",
        "reason": "用于保存本地环境启动和运行日志。",
    },
    "zbcx": {
        "status": "keep",
        "summary": "总部默认程序目录。",
        "reason": "总部端默认程序目录统一放在这里。",
    },
    "dlcx": {
        "status": "keep",
        "summary": "代理默认程序目录。",
        "reason": "代理端默认程序目录统一放在这里。",
    },
    "khcs": {
        "status": "keep",
        "summary": "客户端默认程序目录。",
        "reason": "客户端默认程序目录统一放在这里。",
    },
    ".wiki.md": {
        "status": "keep",
        "summary": "项目总览说明文件。",
        "reason": "便于后续维护时快速定位工程结构。",
    },
    "VERSION_LOG.md": {
        "status": "keep",
        "summary": "版本更新记录。",
        "reason": "用于记录每一轮开发版本推进与主要变更。",
    },
}

WORK_DIR_HINTS: dict[str, dict[str, str]] = {
    "backend": {
        "status": "keep",
        "summary": "后端目录。",
        "reason": "FastAPI、数据库、权限和站点导出逻辑所在目录。",
    },
    "frontend": {
        "status": "keep",
        "summary": "前端目录。",
        "reason": "React + TypeScript + Vite 三端页面代码所在目录。",
    },
    "logs": {
        "status": "keep",
        "summary": "本地环境日志目录。",
        "reason": "用于保存启动和运行日志。",
    },
    "zbcx": {
        "status": "keep",
        "summary": "总部默认程序目录。",
        "reason": "总部端默认程序目录统一放在这里。",
    },
    "dlcx": {
        "status": "keep",
        "summary": "代理默认程序目录。",
        "reason": "代理端默认程序目录统一放在这里。",
    },
    "khcs": {
        "status": "keep",
        "summary": "客户端默认程序目录。",
        "reason": "客户端默认程序目录统一放在这里。",
    },
    "local_static_preview.py": {
        "status": "keep",
        "summary": "本地静态预览脚本。",
        "reason": "用于配合网站静态目录做本地预览联调。",
    },
    "PLATFORM_REBUILD_PLAN.md": {
        "status": "keep",
        "summary": "平台重构计划。",
        "reason": "记录当前系统的重构思路和阶段目标。",
    },
    "start_app_v2.sh": {
        "status": "review",
        "summary": "历史 Shell 启动脚本。",
        "reason": "当前 Windows 本地运行不依赖它，后续可再决定是否保留。",
    },
}

BACKUP_DIR_HINTS: dict[str, dict[str, str]] = {
    "beifencx": {
        "status": "keep",
        "summary": "程序备份目录。",
        "reason": "总部、代理、客户端默认程序版本的备份统一放在这里，默认保留最新 10 个版本。",
    },
    "beifenwz": {
        "status": "keep",
        "summary": "网站备份目录。",
        "reason": "每个独立计划网站版本的备份统一放在这里，默认保留最新 10 个版本。",
    },
}

DATABASE_PATTERNS = ("*.db", "*.sqlite", "*.sqlite3")
PRIMARY_DATABASE_CANDIDATES = ("local_test_py311.db", "b2b_platform.db", "local_test.db")


PATH_REGISTRY_ENV_VAR = "B2B_PATH_REGISTRY_FILE"
PATH_FIELD_NAMES = {
    "codexRoot",
    "projectRoot",
    "appRoot",
    "hqProgramRoot",
    "agencyProgramRoot",
    "clientProgramRoot",
    "siteProgramRoot",
    "backupRoot",
    "programBackupRoot",
    "siteBackupRoot",
    "databaseRoot",
    "hqDbRoot",
    "agencyDbRoot",
    "clientDbRoot",
    "siteDbRoot",
    "activeDatabaseFile",
    "websiteRoot",
    "miscFilesRoot",
    "websiteStyleRoot",
    "assetResourceRoot",
    "localEnvScript",
    "restartLocalEnvScript",
}


def _source_app_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _workspace_root(app_root: Path) -> Path:
    return app_root.resolve().parent


def _configured_path_file(app_root: Path) -> tuple[Path, bool]:
    workspace_root = _workspace_root(app_root)
    configured = os.getenv(PATH_REGISTRY_ENV_VAR, "").strip()
    if configured:
        candidate = Path(configured)
        if not candidate.is_absolute():
            candidate = workspace_root / candidate
        return candidate.resolve(), True
    return (workspace_root / "local-data" / "config" / "path-registry.json").resolve(), False


def _default_config_file(app_root: Path | None = None) -> Path:
    active_app_root = (app_root or _source_app_root()).resolve()
    return _configured_path_file(active_app_root)[0]


def _default_registry_values(app_root: Path | None = None) -> dict[str, Any]:
    app_root = (app_root or _source_app_root()).resolve()
    project_root = app_root
    codex_root = _workspace_root(app_root)
    local_data_root = codex_root / "local-data"
    database_root = codex_root / "06-data-services"
    logical_database_root = database_root / "logical-domains"
    hq_db_root = logical_database_root / "control"
    return {
        "codexRoot": str(codex_root),
        "projectRoot": str(project_root),
        "appRoot": str(app_root),
        "hqProgramRoot": str(codex_root / "01-hq-source-control"),
        "agencyProgramRoot": str(codex_root / "02-agency-runtime"),
        "clientProgramRoot": str(codex_root / "03-client-plan-runtime"),
        "siteProgramRoot": str(local_data_root / "site-public"),
        "backupRoot": str(codex_root / "07-backup-disaster-recovery"),
        "programBackupRoot": str(local_data_root / "backup-staging" / "program"),
        "siteBackupRoot": str(local_data_root / "backup-staging" / "website"),
        "databaseRoot": str(database_root),
        "hqDbRoot": str(hq_db_root),
        "agencyDbRoot": str(logical_database_root / "agency-runtime"),
        "clientDbRoot": str(logical_database_root / "client-plan-runtime"),
        "siteDbRoot": str(logical_database_root / "ops-audit"),
        "activeDatabaseFile": str(local_data_root / "database" / "platform.sqlite3"),
        "websiteRoot": str(local_data_root / "site-public"),
        "miscFilesRoot": str(local_data_root / "protected-misc"),
        "websiteStyleRoot": str(app_root / "shared" / "contracts"),
        "assetResourceRoot": str(local_data_root / "objects" / "asset-private"),
        "localEnvScript": str(codex_root / "local-runtime" / "Start-LocalSandbox.ps1"),
        "restartLocalEnvScript": str(codex_root / "local-runtime" / "Start-LocalSandbox.ps1"),
        "rootNotes": {},
        "backupNotes": {},
    }


def _portable_registry_values(app_root: Path | None = None) -> dict[str, Any]:
    active_app_root = (app_root or _source_app_root()).resolve()
    workspace_root = _workspace_root(active_app_root)
    defaults = _default_registry_values(active_app_root)
    payload: dict[str, Any] = {"schemaVersion": 1, "template": "workspace-relative"}
    for key, value in defaults.items():
        if key in PATH_FIELD_NAMES:
            payload[key] = Path(value).relative_to(workspace_root).as_posix()
        else:
            payload[key] = value
    payload["codexRoot"] = "."
    return payload


def ensure_path_config_file(app_root: Path | None = None) -> Path:
    """Explicitly create a portable machine config; registry reads never call this."""
    active_app_root = (app_root or _source_app_root()).resolve()
    config_path = _default_config_file(active_app_root)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    if not config_path.exists():
        config_path.write_text(
            json.dumps(_portable_registry_values(active_app_root), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return config_path


def _read_json_file(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _looks_absolute_path(value: str) -> bool:
    return Path(value).is_absolute() or bool(re.match(r"^[A-Za-z]:[\\/]", value))


def _resolve_registry_path(
    value: Any,
    default_value: str,
    *,
    workspace_root: Path,
    allow_absolute: bool,
) -> Path:
    default_path = Path(default_value).resolve()
    raw_value = str(value or "").strip()
    if not raw_value:
        return default_path
    if _looks_absolute_path(raw_value):
        return Path(raw_value).resolve() if allow_absolute else default_path
    return (workspace_root / raw_value).resolve()


def _iter_database_files(base_dir: Path) -> list[Path]:
    files: list[Path] = []
    if not base_dir.exists():
        return files
    for pattern in DATABASE_PATTERNS:
        files.extend(base_dir.glob(pattern))
    return sorted({path.resolve() for path in files}, key=lambda item: str(item).lower())


def _unique_destination_path(destination: Path) -> Path:
    if not destination.exists():
        return destination
    stem = destination.stem
    suffix = destination.suffix
    counter = 1
    while True:
        candidate = destination.with_name(f"{stem}-{counter}{suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def _move_file(source: Path, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    final_destination = _unique_destination_path(destination)
    shutil.move(str(source), str(final_destination))
    return final_destination


def _copy_file(source: Path, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    final_destination = _unique_destination_path(destination)
    shutil.copy2(str(source), str(final_destination))
    return final_destination


def ensure_storage_layout(paths: PathRegistry) -> None:
    for path in (
        paths.hq_program_root,
        paths.agency_program_root,
        paths.client_program_root,
        paths.site_program_root,
        paths.backup_root,
        paths.program_backup_root,
        paths.site_backup_root,
        paths.database_root,
        paths.hq_db_root,
        paths.agency_db_root,
        paths.client_db_root,
        paths.site_db_root,
        paths.website_root,
        paths.misc_files_root,
        paths.website_style_root,
        paths.asset_resource_root,
    ):
        path.mkdir(parents=True, exist_ok=True)

    paths.active_database_file.parent.mkdir(parents=True, exist_ok=True)

    legacy_candidates = [paths.backend_root / name for name in PRIMARY_DATABASE_CANDIDATES]
    if not paths.active_database_file.exists():
        for source in legacy_candidates:
            if source.exists() and source.is_file():
                try:
                    _move_file(source, paths.active_database_file)
                except PermissionError:
                    _copy_file(source, paths.active_database_file)
                break

    legacy_db_dir = paths.hq_db_root / "_legacy"
    for db_file in _iter_database_files(paths.backend_root):
        if db_file.parent.resolve() != paths.backend_root.resolve():
            continue
        if db_file == paths.active_database_file.resolve():
            continue
        try:
            _move_file(db_file, legacy_db_dir / db_file.name)
        except PermissionError:
            continue


def get_path_registry(*, app_root: Path | None = None) -> PathRegistry:
    source_app_root = (app_root or _source_app_root()).resolve()
    workspace_root = _workspace_root(source_app_root)
    config_path, explicit_config = _configured_path_file(source_app_root)
    defaults = _default_registry_values(source_app_root)
    configured_payload = _read_json_file(config_path) if config_path.is_file() else {}
    payload = {**defaults, **configured_payload}

    # A config discovered inside the workspace may contain paths from the old
    # computer.  The source-derived roots always win unless the user has
    # explicitly selected a config through B2B_PATH_REGISTRY_FILE.
    if not explicit_config:
        payload["codexRoot"] = defaults["codexRoot"]
        payload["projectRoot"] = defaults["projectRoot"]
        payload["appRoot"] = defaults["appRoot"]
        payload["websiteStyleRoot"] = defaults["websiteStyleRoot"]

    resolved_paths = {
        key: _resolve_registry_path(
            payload.get(key),
            defaults[key],
            workspace_root=workspace_root,
            allow_absolute=explicit_config,
        )
        for key in PATH_FIELD_NAMES
    }

    codex_root = resolved_paths["codexRoot"]
    project_root = resolved_paths["projectRoot"]
    app_root = resolved_paths["appRoot"]
    backend_root = app_root / "backend"
    frontend_root = app_root / "frontend"
    hq_program_root = resolved_paths["hqProgramRoot"]
    agency_program_root = resolved_paths["agencyProgramRoot"]
    client_program_root = resolved_paths["clientProgramRoot"]
    site_program_root = resolved_paths["siteProgramRoot"]
    backup_root = resolved_paths["backupRoot"]
    program_backup_root = resolved_paths["programBackupRoot"]
    site_backup_root = resolved_paths["siteBackupRoot"]
    database_root = resolved_paths["databaseRoot"]
    hq_db_root = resolved_paths["hqDbRoot"]
    agency_db_root = resolved_paths["agencyDbRoot"]
    client_db_root = resolved_paths["clientDbRoot"]
    site_db_root = resolved_paths["siteDbRoot"]
    active_database_file = resolved_paths["activeDatabaseFile"]
    website_root = resolved_paths["websiteRoot"]
    misc_files_root = resolved_paths["miscFilesRoot"]
    website_style_root = resolved_paths["websiteStyleRoot"]
    asset_resource_root = resolved_paths["assetResourceRoot"]
    local_env_script = resolved_paths["localEnvScript"]
    restart_local_env_script = resolved_paths["restartLocalEnvScript"]

    configured_root_notes = configured_payload.get("rootNotes")
    configured_backup_notes = configured_payload.get("backupNotes")
    root_notes = {
        **ROOT_HELPER_FILE_HINTS,
        **(configured_root_notes if isinstance(configured_root_notes, dict) else {}),
    }
    backup_notes = {
        **BACKUP_DIR_HINTS,
        **(configured_backup_notes if isinstance(configured_backup_notes, dict) else {}),
    }

    paths = PathRegistry(
        codex_root=codex_root,
        project_root=project_root,
        app_root=app_root,
        backend_root=backend_root,
        frontend_root=frontend_root,
        hq_program_root=hq_program_root,
        agency_program_root=agency_program_root,
        client_program_root=client_program_root,
        site_program_root=site_program_root,
        backup_root=backup_root,
        program_backup_root=program_backup_root,
        site_backup_root=site_backup_root,
        database_root=database_root,
        hq_db_root=hq_db_root,
        agency_db_root=agency_db_root,
        client_db_root=client_db_root,
        site_db_root=site_db_root,
        active_database_file=active_database_file,
        website_root=website_root,
        misc_files_root=misc_files_root,
        website_style_root=website_style_root,
        asset_resource_root=asset_resource_root,
        local_env_script=local_env_script,
        restart_local_env_script=restart_local_env_script,
        path_config_file=config_path.resolve(),
        root_notes=root_notes,
        backup_notes=backup_notes,
    )
    return paths


def initialize_local_storage_layout(paths: PathRegistry | None = None) -> PathRegistry:
    """Explicit local-development initialization; ordinary registry reads stay read-only."""
    active_paths = paths or get_path_registry()
    ensure_path_config_file(app_root=active_paths.app_root)
    ensure_storage_layout(active_paths)
    return active_paths


def build_artifact_notes(base_dir: Path, hints: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    if not base_dir.exists():
        return []

    items: list[dict[str, Any]] = []
    for item in sorted(base_dir.iterdir(), key=lambda entry: (entry.is_file(), entry.name.lower())):
        hint = hints.get(item.name)
        status = hint["status"] if hint else "review"
        items.append(
            {
                "name": item.name,
                "path": str(item),
                "kind": "directory" if item.is_dir() else "file",
                "status": status,
                "summary": hint["summary"] if hint else "新发现的目录或文件，请确认用途。",
                "reason": hint["reason"] if hint else "该项不在当前预设清单中，如需长期保留请补充用途说明。",
            }
        )
    return items


def _read_yaml_mapping(path: Path) -> tuple[dict[str, Any], str | None]:
    if not path.is_file():
        return {}, f"Missing deployment definition: {path}"
    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        return {}, f"Invalid deployment definition {path}: {exc}"
    if not isinstance(payload, dict):
        return {}, f"Deployment definition must be a mapping: {path}"
    return payload, None


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None]


def _as_int(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_bool(value: Any, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return fallback


MODULE_ARCHITECTURE_MAX_BYTES = 2 * 1024 * 1024
MODULE_ARCHITECTURE_PATH_DEFAULTS = {
    "technicalCatalogFile": "modules/technical-category-catalog.json",
    "categoriesRoot": "modules",
}
MODULE_ARCHITECTURE_PRODUCT_SOURCE_DEFAULT = {
    "file": "frontend/src/lib/factory-platform-blueprint.ts",
    "authority": "product",
    "categoryCount": 0,
    "applicationCount": 0,
    "owns": [],
}
MODULE_ARCHITECTURE_SHELL_ROOT_DEFAULTS = {
    "sourceShell": "zbcx/compositions",
    "agencyRuntimeShell": "dlcx",
    "clientRuntimeShell": "khcs",
}


def _normalize_module_records(value: Any, *, field_name: str, errors: list[str]) -> list[dict[str, Any]]:
    """Accept either an ordered record list or a mapping keyed by stable id."""
    records: list[dict[str, Any]] = []
    if value is None:
        return records
    if isinstance(value, dict):
        items = value.items()
        for key, item in items:
            if isinstance(item, dict):
                record = dict(item)
                record.setdefault("id", str(key))
            elif isinstance(item, str):
                record = {"id": str(key), "label": item}
            else:
                errors.append(f"moduleArchitecture.{field_name}.{key} must be an object or string")
                continue
            records.append(record)
        return records
    if not isinstance(value, list):
        errors.append(f"moduleArchitecture.{field_name} must be an array or object")
        return records
    for index, item in enumerate(value):
        if isinstance(item, dict):
            records.append(dict(item))
        elif isinstance(item, str):
            records.append({"id": item, "label": item})
        else:
            errors.append(f"moduleArchitecture.{field_name}[{index}] must be an object or string")
    return records


def _normalize_module_path(
    app_root: Path,
    value: Any,
    *,
    field_name: str,
    fallback: str,
    errors: list[str],
) -> str:
    """Keep contract paths source-relative and reject paths that escape the source root."""
    raw_value = str(value or fallback).strip() or fallback
    candidate = Path(raw_value)
    if candidate.is_absolute() or _looks_absolute_path(raw_value):
        errors.append(f"moduleArchitecture.{field_name} must be relative to the source root")
        return fallback
    try:
        resolved = (app_root / candidate).resolve()
        relative = resolved.relative_to(app_root.resolve())
    except (OSError, ValueError):
        errors.append(f"moduleArchitecture.{field_name} escapes the source root")
        return fallback
    return relative.as_posix()


def _normalize_product_source(app_root: Path, value: Any, *, errors: list[str]) -> dict[str, Any]:
    default = dict(MODULE_ARCHITECTURE_PRODUCT_SOURCE_DEFAULT)
    if isinstance(value, str):
        payload: dict[str, Any] = {"file": value}
    elif isinstance(value, dict):
        payload = dict(value)
    elif value is None:
        payload = {}
    else:
        errors.append("moduleArchitecture.productSourceOfTruth must be an object")
        payload = {}
    result = {**default, **payload}
    result["file"] = _normalize_module_path(
        app_root,
        result.get("file"),
        field_name="productSourceOfTruth.file",
        fallback=str(default["file"]),
        errors=errors,
    )
    owns = result.get("owns")
    if not isinstance(owns, list):
        errors.append("moduleArchitecture.productSourceOfTruth.owns must be an array")
        owns = []
    result["owns"] = [str(item) for item in owns if item is not None]
    result["categoryCount"] = _as_int(result.get("categoryCount"), 0)
    result["applicationCount"] = _as_int(result.get("applicationCount"), 0)
    return result


def _normalize_shell_composition_roots(app_root: Path, value: Any, *, errors: list[str]) -> dict[str, str]:
    if isinstance(value, dict):
        payload = value
    elif value is None:
        payload = {}
    else:
        errors.append("moduleArchitecture.shellCompositionsRoot must be an object")
        payload = {}
    return {
        field_name: _normalize_module_path(
            app_root,
            payload.get(field_name),
            field_name=f"shellCompositionsRoot.{field_name}",
            fallback=fallback,
            errors=errors,
        )
        for field_name, fallback in MODULE_ARCHITECTURE_SHELL_ROOT_DEFAULTS.items()
    }


def _normalize_optional_module_path(
    app_root: Path,
    value: Any,
    *,
    field_name: str,
    errors: list[str],
) -> str:
    raw_value = str(value or "").strip()
    if not raw_value:
        return ""
    return _normalize_module_path(
        app_root,
        raw_value,
        field_name=field_name,
        fallback="",
        errors=errors,
    )


def _normalize_module_record_paths(
    app_root: Path,
    records: list[dict[str, Any]],
    *,
    field_name: str,
    path_fields: tuple[str, ...],
    errors: list[str],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        item = dict(record)
        for path_field in path_fields:
            if path_field in item:
                item[path_field] = _normalize_optional_module_path(
                    app_root,
                    item.get(path_field),
                    field_name=f"{field_name}[{index}].{path_field}",
                    errors=errors,
                )
        normalized.append(item)
    return normalized


def _resolved_module_path(app_root: Path, relative_path: Any) -> str:
    raw_value = str(relative_path or "").strip()
    return str((app_root / raw_value).resolve()) if raw_value else ""


def build_module_architecture_catalog(paths: PathRegistry | None = None) -> dict[str, Any]:
    """Read the progressive-module contract without mutating local state.

    A missing, oversized, malformed, or partially migrated contract always
    returns the same API shape.  This lets the Source & Deployment Center stay
    usable while a source tree is being moved to another computer.
    """
    active_paths = paths or get_path_registry()
    app_root = active_paths.app_root.resolve()
    contract_file = active_paths.module_architecture_file
    errors: list[str] = []
    payload: dict[str, Any] = {}
    available = False

    try:
        resolved_contract_file = contract_file.resolve()
        resolved_contract_file.relative_to(app_root)
    except (OSError, ValueError):
        resolved_contract_file = contract_file
        errors.append("Module architecture contract resolves outside the active source root")
    else:
        if not resolved_contract_file.is_file():
            errors.append(f"Missing module architecture contract: {resolved_contract_file}")
        else:
            try:
                if resolved_contract_file.stat().st_size > MODULE_ARCHITECTURE_MAX_BYTES:
                    errors.append(
                        f"Module architecture contract exceeds {MODULE_ARCHITECTURE_MAX_BYTES} bytes: "
                        f"{resolved_contract_file}"
                    )
                else:
                    loaded = json.loads(resolved_contract_file.read_text(encoding="utf-8"))
                    if isinstance(loaded, dict):
                        payload = loaded
                        available = True
                    else:
                        errors.append(f"Module architecture contract must be an object: {resolved_contract_file}")
            except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                errors.append(f"Invalid module architecture contract {resolved_contract_file}: {exc}")

    normalized_paths = {
        field_name: _normalize_module_path(
            app_root,
            payload.get(field_name),
            field_name=field_name,
            fallback=fallback,
            errors=errors,
        )
        for field_name, fallback in MODULE_ARCHITECTURE_PATH_DEFAULTS.items()
    }
    migration_phase = payload.get("migrationPhase")
    if isinstance(migration_phase, str):
        migration_phase = {"id": migration_phase}
    elif not isinstance(migration_phase, dict):
        if migration_phase is not None:
            errors.append("moduleArchitecture.migrationPhase must be an object")
        migration_phase = {"id": "contract-bootstrap" if available else "unavailable"}
    else:
        migration_phase = dict(migration_phase)
    strategy = payload.get("strategy")
    if isinstance(strategy, str):
        strategy = {"id": strategy}
    elif not isinstance(strategy, dict):
        if strategy is not None:
            errors.append("moduleArchitecture.strategy must be an object")
        strategy = {"id": "progressive-modular-monolith" if available else "contract-unavailable"}
    else:
        strategy = dict(strategy)
    deployment_boundary = payload.get("deploymentBoundary")
    if not isinstance(deployment_boundary, dict):
        if deployment_boundary is not None:
            errors.append("moduleArchitecture.deploymentBoundary must be an object")
        deployment_boundary = {}
    principles = payload.get("principles")
    if not isinstance(principles, list):
        if principles is not None:
            errors.append("moduleArchitecture.principles must be an array")
        principles = []
    else:
        principles = [item for item in principles if isinstance(item, (str, dict))]

    product_source = _normalize_product_source(app_root, payload.get("productSourceOfTruth"), errors=errors)
    shell_roots = _normalize_shell_composition_roots(
        app_root, payload.get("shellCompositionsRoot"), errors=errors
    )
    categories = _normalize_module_records(payload.get("categories"), field_name="categories", errors=errors)
    legacy_mappings = _normalize_module_records(
        payload.get("legacyMappings"), field_name="legacyMappings", errors=errors
    )
    pilot_applications = _normalize_module_record_paths(
        app_root,
        _normalize_module_records(
            payload.get("pilotApplications"), field_name="pilotApplications", errors=errors
        ),
        field_name="pilotApplications",
        path_fields=("directory", "manifest"),
        errors=errors,
    )
    compositions = _normalize_module_record_paths(
        app_root,
        _normalize_module_records(payload.get("compositions"), field_name="compositions", errors=errors),
        field_name="compositions",
        path_fields=("file",),
        errors=errors,
    )
    resolved_paths = {
        "contractFile": str(resolved_contract_file),
        "productSourceOfTruth": _resolved_module_path(app_root, product_source["file"]),
        "technicalCatalog": _resolved_module_path(app_root, normalized_paths["technicalCatalogFile"]),
        "categoriesRoot": _resolved_module_path(app_root, normalized_paths["categoriesRoot"]),
        "shellCompositionsRoot": {
            key: _resolved_module_path(app_root, value) for key, value in shell_roots.items()
        },
        "compositionsById": {
            str(item.get("id")): _resolved_module_path(app_root, item.get("file"))
            for item in compositions
            if item.get("id") and item.get("file")
        },
        "pilotManifestById": {
            str(item.get("id")): _resolved_module_path(app_root, item.get("manifest"))
            for item in pilot_applications
            if item.get("id") and item.get("manifest")
        },
        "pilotDirectoryById": {
            str(item.get("id")): _resolved_module_path(app_root, item.get("directory"))
            for item in pilot_applications
            if item.get("id") and item.get("directory")
        },
    }

    return {
        "available": available,
        "sourceFile": str(resolved_contract_file),
        "resolvedPaths": resolved_paths,
        "contractVersion": str(payload.get("contractVersion") or payload.get("schemaVersion") or ""),
        "strategy": strategy,
        "productSourceOfTruth": product_source,
        **normalized_paths,
        "shellCompositionsRoot": shell_roots,
        "migrationPhase": migration_phase,
        "categories": categories,
        "legacyMappings": legacy_mappings,
        "pilotApplications": pilot_applications,
        "compositions": compositions,
        "deploymentBoundary": dict(deployment_boundary),
        "principles": list(principles),
        "errors": errors,
    }


def _resolve_from_app_root(app_root: Path, value: Any) -> Path:
    candidate = Path(str(value or ""))
    if not candidate.is_absolute():
        candidate = app_root / candidate
    return candidate.resolve()


def _normalize_role_definition(
    payload: dict[str, Any],
    *,
    role_number: int,
    definition_file: Path,
    app_root: Path,
) -> dict[str, Any]:
    role_id = str(payload.get("id") or f"{role_number:02d}").zfill(2)
    role_name = str(payload.get("name") or f"role-{role_id}")
    artifact_root = _resolve_from_app_root(
        app_root,
        payload.get("artifactRoot") or f"../{role_name}/releases",
    )
    environment_template = payload.get("environmentTemplate")
    return {
        "id": role_id,
        "name": role_name,
        "label": str(payload.get("label") or role_name or f"角色 {role_id}"),
        "purpose": str(payload.get("purpose") or payload.get("description") or ""),
        "rulePath": str(definition_file.resolve()),
        "sourceIncludes": _as_string_list(payload.get("sourceIncludes")),
        "sourceExcludes": _as_string_list(payload.get("sourceExcludes")),
        "dependencies": _as_string_list(payload.get("dependencies")),
        "artifactRoot": str(artifact_root),
        "environmentTemplate": str(_resolve_from_app_root(app_root, environment_template)) if environment_template else "",
        "healthChecks": payload.get("healthChecks") if isinstance(payload.get("healthChecks"), list) else [],
        "deployOrder": _as_int(payload.get("deployOrder"), role_number * 10),
        "rollbackPolicy": payload.get("rollbackPolicy") if isinstance(payload.get("rollbackPolicy"), dict) else {},
    }


def _normalize_release_flow_step(payload: dict[str, Any], *, fallback_order: int) -> dict[str, Any]:
    evidence = _as_string_list(payload.get("evidence"))
    configured_input = payload.get("input")
    configured_output = payload.get("output")
    configured_gate = payload.get("gate")
    return {
        "id": str(payload.get("id") or f"step-{fallback_order:02d}"),
        "order": _as_int(payload.get("order"), fallback_order),
        "title": str(payload.get("title") or payload.get("label") or f"步骤 {fallback_order}"),
        "description": str(payload.get("description") or payload.get("purpose") or ""),
        "input": configured_input if configured_input is not None else [],
        "actions": _as_string_list(payload.get("actions")),
        "output": configured_output if configured_output is not None else evidence,
        "gate": configured_gate if configured_gate is not None else evidence,
        "rollback": payload.get("rollback") if payload.get("rollback") is not None else payload.get("failureAction", ""),
    }


def _normalize_profile_role(value: Any) -> str:
    normalized = str(value or "").strip()
    return normalized.zfill(2) if normalized.isdigit() else normalized


def _normalize_deployment_profile(
    payload: dict[str, Any],
    *,
    profile_number: int,
    definition_file: Path,
) -> dict[str, Any]:
    server_count = _as_int(payload.get("serverCount"), profile_number)
    purpose = str(payload.get("recommendedFor") or payload.get("purpose") or "")
    raw_servers = payload.get("assignments") or payload.get("servers")
    assignments: list[dict[str, Any]] = []
    if isinstance(raw_servers, list):
        for index, server in enumerate(raw_servers, start=1):
            if not isinstance(server, dict):
                continue
            roles = [_normalize_profile_role(item) for item in _as_string_list(server.get("roles"))]
            assignments.append(
                {
                    "server": str(server.get("server") or server.get("id") or f"SERVER-{index:02d}"),
                    "roles": roles,
                    "summary": str(server.get("summary") or ""),
                }
            )
    external_backup = payload.get("externalBackupRequired")
    if external_backup is None:
        external_backup = payload.get("external_backup_required")
    return {
        "serverCount": server_count,
        "label": str(payload.get("label") or f"{server_count}台 · {purpose or '服务器方案'}"),
        "recommendedFor": purpose,
        "assignments": assignments,
        "externalBackupRequired": _as_bool(external_backup, server_count < 7),
        "profilePath": str(definition_file.resolve()),
    }


def build_deployment_catalog(paths: PathRegistry | None = None) -> dict[str, Any]:
    """Read the seven role rules and six-step release flow from the active app root."""
    active_paths = paths or get_path_registry()
    role_root = active_paths.deployment_role_definitions_root
    flow_file = active_paths.global_release_flow_file
    profiles_root = active_paths.deployment_profiles_root
    errors: list[str] = []
    roles: list[dict[str, Any]] = []
    profiles: list[dict[str, Any]] = []

    for role_number in range(1, 8):
        definition_file = role_root / f"role-{role_number:02d}.yaml"
        payload, error = _read_yaml_mapping(definition_file)
        if error:
            errors.append(error)
            continue
        roles.append(
            _normalize_role_definition(
                payload,
                role_number=role_number,
                definition_file=definition_file,
                app_root=active_paths.app_root,
            )
        )

    for profile_number in range(1, 8):
        definition_file = profiles_root / f"{profile_number:02d}-server.yaml"
        payload, error = _read_yaml_mapping(definition_file)
        if error:
            errors.append(error)
            continue
        profile = _normalize_deployment_profile(
            payload,
            profile_number=profile_number,
            definition_file=definition_file,
        )
        if profile["serverCount"] != profile_number:
            errors.append(
                f"Deployment profile serverCount does not match its filename: {definition_file}"
            )
            continue
        if len(profile["assignments"]) != profile_number:
            errors.append(
                f"Deployment profile must define {profile_number} server assignments: {definition_file}"
            )
            continue
        profiles.append(profile)

    flow_payload, flow_error = _read_yaml_mapping(flow_file)
    if flow_error:
        errors.append(flow_error)
    raw_steps = flow_payload.get("steps") if isinstance(flow_payload.get("steps"), list) else []
    steps = [
        _normalize_release_flow_step(step, fallback_order=index)
        for index, step in enumerate(raw_steps, start=1)
        if isinstance(step, dict)
    ]
    steps.sort(key=lambda item: (item["order"], item["id"]))
    release_flow = {
        "version": str(flow_payload.get("version") or flow_payload.get("schemaVersion") or ""),
        "title": str(flow_payload.get("title") or flow_payload.get("label") or "全局发布流程"),
        "description": str(flow_payload.get("description") or ""),
        "sourceFile": str(flow_file.resolve()),
        "steps": steps,
    }

    return {
        "deploymentRoleDefinitionsRoot": str(role_root.resolve()),
        "globalReleaseFlowFile": str(flow_file.resolve()),
        "roleDefinitions": roles,
        "deploymentProfiles": profiles,
        "globalReleaseFlow": release_flow,
        "deploymentCatalogErrors": errors,
    }


def build_workspace_artifact_payload(paths: PathRegistry | None = None) -> dict[str, Any]:
    paths = paths or get_path_registry()
    return {
        "rootArtifacts": build_artifact_notes(paths.codex_root, paths.root_notes),
        "releaseDirectories": build_artifact_notes(paths.project_root, RELEASE_DIR_HINTS),
        "workArtifacts": build_artifact_notes(paths.app_root, WORK_DIR_HINTS),
        "backupArtifacts": build_artifact_notes(paths.backup_root, paths.backup_notes),
    }


def sanitize_folder_name(value: str, fallback: str = "未命名项目") -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', " ", value or "").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:60] or fallback


def remove_empty_directory(path: Path) -> None:
    if not path.exists() or not path.is_dir():
        return
    try:
        next(path.iterdir())
    except StopIteration:
        path.rmdir()


def move_json_files(source_dir: Path, target_dir: Path) -> int:
    if not source_dir.exists() or source_dir.resolve() == target_dir.resolve():
        return 0

    target_dir.mkdir(parents=True, exist_ok=True)
    moved = 0
    for source in source_dir.rglob("*.json"):
        destination = target_dir / source.name
        if destination.exists():
            continue
        shutil.move(str(source), str(destination))
        moved += 1

    for directory in sorted(source_dir.rglob("*"), reverse=True):
        if directory.is_dir():
            remove_empty_directory(directory)
    remove_empty_directory(source_dir)
    return moved


def collect_database_files(paths: PathRegistry | None = None) -> list[Path]:
    active_paths = paths or get_path_registry()
    results: list[Path] = []
    for base_dir in (
        active_paths.hq_db_root,
        active_paths.agency_db_root,
        active_paths.client_db_root,
        active_paths.site_db_root,
    ):
        results.extend(_iter_database_files(base_dir))
    return sorted({path.resolve() for path in results}, key=lambda item: str(item).lower())
