"""Generate a read-only JSON release plan from role and server-profile rules.

This command intentionally has no copy, mkdir, archive, upload, secret loading,
or remote-deployment capability. It resolves the plan against the current
workspace so the committed YAML remains portable between computers.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIRECTORY.parent.parent
WORKSPACE_ROOT = REPOSITORY_ROOT.parent
VERSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
ROLE_IDS = tuple(f"{number:02d}" for number in range(1, 8))


class PlanError(ValueError):
    """Raised when committed deployment rules cannot form a safe plan."""


def _read(path: Path) -> str:
    if not path.is_file():
        raise PlanError(f"required rule file does not exist: {path}")
    return path.read_text(encoding="utf-8-sig")


def _scalar(value: str) -> Any:
    value = value.strip()
    if value.startswith('"') and value.endswith('"'):
        return json.loads(value)
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    if value == "true":
        return True
    if value == "false":
        return False
    if value == "null":
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    return value


def _top_value(text: str, key: str) -> Any:
    match = re.search(rf"^{re.escape(key)}:\s*(.+?)\s*$", text, re.MULTILINE)
    if not match:
        raise PlanError(f"missing top-level field: {key}")
    return _scalar(match.group(1))


def _inline_list(text: str, key: str) -> list[str]:
    raw = _top_value(text, key)
    if not isinstance(raw, str) or not raw.startswith("["):
        raise PlanError(f"{key} must be a JSON-compatible inline list")
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise PlanError(f"invalid inline list for {key}") from exc
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise PlanError(f"{key} must contain strings only")
    return value


def _block_lines(text: str, key: str) -> list[str]:
    lines = text.splitlines()
    try:
        start = lines.index(f"{key}:")
    except ValueError as exc:
        raise PlanError(f"missing block field: {key}") from exc
    result: list[str] = []
    for line in lines[start + 1 :]:
        if line and not line.startswith(" "):
            break
        result.append(line)
    return result


def _string_list(text: str, key: str) -> list[str]:
    values: list[str] = []
    for line in _block_lines(text, key):
        match = re.fullmatch(r"  -\s+(.+)", line)
        if match:
            value = _scalar(match.group(1))
            if not isinstance(value, str):
                raise PlanError(f"{key} must contain strings only")
            values.append(value)
    if not values:
        raise PlanError(f"{key} cannot be empty")
    return values


def _mapping(text: str, key: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for line in _block_lines(text, key):
        match = re.fullmatch(r"  ([A-Za-z][A-Za-z0-9]*):\s*(.+)", line)
        if match:
            result[match.group(1)] = _scalar(match.group(2))
    if not result:
        raise PlanError(f"{key} cannot be empty")
    return result


def _object_list(text: str, key: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in _block_lines(text, key):
        item = re.fullmatch(r"  - ([A-Za-z][A-Za-z0-9]*):\s*(.+)", line)
        if item:
            current = {item.group(1): _scalar(item.group(2))}
            result.append(current)
            continue
        field = re.fullmatch(r"    ([A-Za-z][A-Za-z0-9]*):\s*(.+)", line)
        if field and current is not None:
            current[field.group(1)] = _scalar(field.group(2))
    if not result:
        raise PlanError(f"{key} cannot be empty")
    return result


def _parse_role(role_id: str) -> dict[str, Any]:
    rule_relative = Path("deployment") / "role-definitions" / f"role-{role_id}.yaml"
    rule_path = REPOSITORY_ROOT / rule_relative
    text = _read(rule_path)
    parsed_id = str(_top_value(text, "id")).zfill(2)
    if parsed_id != role_id:
        raise PlanError(f"{rule_relative} declares id {parsed_id}, expected {role_id}")
    role = {
        "id": parsed_id,
        "name": _top_value(text, "name"),
        "label": _top_value(text, "label"),
        "purpose": _top_value(text, "purpose"),
        "rulePath": _top_value(text, "rulePath"),
        "sourceIncludes": _string_list(text, "sourceIncludes"),
        "sourceExcludes": _string_list(text, "sourceExcludes"),
        "dependencies": _inline_list(text, "dependencies"),
        "artifactRootRule": _top_value(text, "artifactRoot"),
        "environmentTemplateRule": _top_value(text, "environmentTemplate"),
        "healthChecks": _object_list(text, "healthChecks"),
        "deployOrder": _top_value(text, "deployOrder"),
        "rollbackPolicy": _mapping(text, "rollbackPolicy"),
    }
    if role["rulePath"] != rule_relative.as_posix():
        raise PlanError(f"role {role_id} rulePath does not point to its own rule")
    if not isinstance(role["deployOrder"], int) or role["deployOrder"] <= 0:
        raise PlanError(f"role {role_id} has an invalid deployOrder")
    return role


def _parse_profile(server_count: int) -> dict[str, Any]:
    profile_relative = Path("deployment") / "profiles" / f"{server_count:02d}-server.yaml"
    profile_path = REPOSITORY_ROOT / profile_relative
    text = _read(profile_path)
    servers: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in _block_lines(text, "servers"):
        multiline = re.fullmatch(r"  - id:\s*(.+)", line)
        if multiline:
            current = {"id": _scalar(multiline.group(1))}
            servers.append(current)
            continue
        inline = re.fullmatch(r"  - \{id:\s*([^,]+),\s*roles:\s*(\[[^\]]*\]),\s*summary:\s*(.+)\}", line)
        if inline:
            current = {
                "id": _scalar(inline.group(1)),
                "roles": json.loads(inline.group(2)),
                "summary": _scalar(inline.group(3)),
            }
            servers.append(current)
            continue
        field = re.fullmatch(r"    (roles|summary):\s*(.+)", line)
        if field and current is not None:
            current[field.group(1)] = json.loads(field.group(2)) if field.group(1) == "roles" else _scalar(field.group(2))
    if len(servers) != server_count:
        raise PlanError(f"{profile_relative} contains {len(servers)} servers, expected {server_count}")
    for server in servers:
        if not isinstance(server.get("roles"), list) or not server["roles"]:
            raise PlanError(f"server {server.get('id')} has no role assignment")
    return {
        "sourceFile": profile_relative.as_posix(),
        "profile": _top_value(text, "profile"),
        "serverCount": _top_value(text, "serverCount"),
        "purpose": _top_value(text, "purpose"),
        "externalBackupRequired": _top_value(text, "external_backup_required"),
        "roleDefinitionsRoot": _top_value(text, "roleDefinitionsRoot"),
        "releaseFlow": _top_value(text, "releaseFlow"),
        "sourcePolicy": _top_value(text, "sourcePolicy"),
        "servers": servers,
    }


def _inside(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _resolve_role_paths(role: dict[str, Any], version: str) -> dict[str, Any]:
    artifact_root = (REPOSITORY_ROOT / str(role["artifactRootRule"])).resolve()
    expected_root = (WORKSPACE_ROOT / f"{role['id']}-{role['name']}" / "releases").resolve()
    if artifact_root != expected_root:
        raise PlanError(f"role {role['id']} artifactRoot must resolve to {expected_root}")
    if not _inside(artifact_root, WORKSPACE_ROOT) or _inside(artifact_root, REPOSITORY_ROOT):
        raise PlanError(f"role {role['id']} artifactRoot crosses the permitted workspace boundary")
    environment_template = (REPOSITORY_ROOT / str(role["environmentTemplateRule"])).resolve()
    if not environment_template.is_file() or not _inside(environment_template, REPOSITORY_ROOT):
        raise PlanError(f"role {role['id']} environment template is invalid")
    rule_path = (REPOSITORY_ROOT / str(role["rulePath"])).resolve()
    version_root = (artifact_root / version).resolve()
    if not _inside(version_root, artifact_root):
        raise PlanError("version would escape its artifact root")
    return {
        **role,
        "rulePath": str(rule_path),
        "artifactRoot": str(artifact_root),
        "versionArtifactRoot": str(version_root),
        "environmentTemplate": str(environment_template),
    }


def _dependency_order(roles: dict[str, dict[str, Any]]) -> list[str]:
    selected = set(roles)
    for role_id, role in roles.items():
        unknown = set(role["dependencies"]) - selected
        if unknown:
            raise PlanError(f"role {role_id} dependencies are missing from the selected profile: {sorted(unknown)}")
    ordered: list[str] = []
    remaining = set(selected)
    while remaining:
        ready = [
            role_id
            for role_id in remaining
            if set(roles[role_id]["dependencies"]).issubset(ordered)
        ]
        if not ready:
            raise PlanError(f"role dependency cycle detected: {sorted(remaining)}")
        ready.sort(key=lambda role_id: (roles[role_id]["deployOrder"], role_id))
        for role_id in ready:
            ordered.append(role_id)
            remaining.remove(role_id)
    return ordered


def generate_plan(server_count: int, version: str) -> dict[str, Any]:
    if server_count not in range(1, 8):
        raise PlanError("server count must be an integer from 1 through 7")
    if not VERSION_PATTERN.fullmatch(version):
        raise PlanError("version must be 1-64 characters using letters, digits, dot, underscore, or hyphen")

    profile = _parse_profile(server_count)
    if profile["serverCount"] != server_count:
        raise PlanError("profile serverCount does not match the requested server count")
    selected_ids = []
    target_servers: dict[str, list[str]] = {}
    for server in profile["servers"]:
        for role_id in server["roles"]:
            if role_id in selected_ids:
                raise PlanError(f"role {role_id} is assigned more than once")
            if role_id not in ROLE_IDS:
                raise PlanError(f"profile contains unknown role {role_id}")
            selected_ids.append(role_id)
            target_servers.setdefault(role_id, []).append(str(server["id"]))

    roles = {role_id: _resolve_role_paths(_parse_role(role_id), version) for role_id in selected_ids}
    deployment_order = _dependency_order(roles)
    role_plans = []
    for role_id in deployment_order:
        role = roles[role_id]
        role_plans.append(
            {
                "id": role["id"],
                "name": role["name"],
                "label": role["label"],
                "purpose": role["purpose"],
                "targetServers": target_servers[role_id],
                "dependencies": role["dependencies"],
                "deployOrder": role["deployOrder"],
                "rulePath": role["rulePath"],
                "artifactRoot": role["artifactRoot"],
                "versionArtifactRoot": role["versionArtifactRoot"],
                "sourceIncludes": role["sourceIncludes"],
                "sourceExcludes": role["sourceExcludes"],
                "environmentTemplate": role["environmentTemplate"],
                "healthChecks": role["healthChecks"],
                "rollbackPolicy": role["rollbackPolicy"],
            }
        )

    release_flow = (REPOSITORY_ROOT / str(profile["releaseFlow"])).resolve()
    if not release_flow.is_file() or not _inside(release_flow, REPOSITORY_ROOT):
        raise PlanError("profile releaseFlow is invalid")
    return {
        "planSchemaVersion": 1,
        "dryRun": True,
        "version": version,
        "sourceRoot": str(REPOSITORY_ROOT),
        "workspaceRoot": str(WORKSPACE_ROOT),
        "releaseFlow": str(release_flow),
        "profile": profile,
        "deploymentOrder": deployment_order,
        "roles": role_plans,
        "safety": {
            "filesystemWrites": 0,
            "copiesSource": False,
            "createsArtifactDirectories": False,
            "loadsEnvironmentOrSecrets": False,
            "uploadsOrContactsServers": False,
            "message": "This is a plan only; build and publish require a separate reviewed command.",
        },
    }


def run_self_check() -> dict[str, Any]:
    cases = []
    for server_count in range(1, 8):
        plan = generate_plan(server_count, "self-check.1")
        cases.append(
            {
                "serverCount": server_count,
                "serverEntries": len(plan["profile"]["servers"]),
                "roles": plan["deploymentOrder"],
                "dryRun": plan["dryRun"],
                "filesystemWrites": plan["safety"]["filesystemWrites"],
            }
        )
    return {"ok": True, "checkedProfiles": 7, "cases": cases}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate a read-only JSON deployment plan.")
    parser.add_argument("server_count", nargs="?", type=int, help="server profile number, 1 through 7")
    parser.add_argument("version", nargs="?", help="release version, for example 2026.08.18.1")
    parser.add_argument("--self-check", action="store_true", help="validate all seven profiles without writing files")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    try:
        if args.self_check:
            if args.server_count is not None or args.version is not None:
                parser.error("--self-check does not accept server_count or version")
            result = run_self_check()
        else:
            if args.server_count is None or args.version is None:
                parser.error("server_count and version are required unless --self-check is used")
            result = generate_plan(args.server_count, args.version)
    except PlanError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

