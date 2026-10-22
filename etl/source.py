"""Fetch the workbook: either a local file or a SharePoint sharing link via Microsoft Graph."""
import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import msal
import requests

from .config import Settings

GRAPH = "https://graph.microsoft.com/v1.0"


@dataclass
class SourceFile:
    path: Path
    name: str
    etag: str | None
    modified_at: str | None  # ISO 8601


def from_local(path: str) -> SourceFile:
    p = Path(path).expanduser().resolve()
    if not p.is_file():
        raise FileNotFoundError(p)
    stat = p.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    # Local files have no eTag; size + mtime is good enough to detect changes.
    return SourceFile(path=p, name=p.name, etag=f"local:{stat.st_size}:{int(stat.st_mtime)}", modified_at=mtime)


def _share_id(url: str) -> str:
    # https://learn.microsoft.com/graph/api/shares-get#encoding-sharing-urls
    encoded = base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")
    return f"u!{encoded}"


def _get_token(s: Settings) -> str:
    if not (s.tenant_id and s.client_id):
        raise RuntimeError("Thiếu AZURE_TENANT_ID / AZURE_CLIENT_ID trong .env")
    authority = f"https://login.microsoftonline.com/{s.tenant_id}"

    if s.client_secret:
        app = msal.ConfidentialClientApplication(s.client_id, authority=authority, client_credential=s.client_secret)
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    else:
        cache = msal.SerializableTokenCache()
        if s.token_cache_path.exists():
            cache.deserialize(s.token_cache_path.read_text(encoding="utf-8"))
        app = msal.PublicClientApplication(s.client_id, authority=authority, token_cache=cache)
        scopes = ["Files.Read.All"]
        accounts = app.get_accounts()
        result = app.acquire_token_silent(scopes, account=accounts[0]) if accounts else None
        if not result:
            flow = app.initiate_device_flow(scopes=scopes)
            if "user_code" not in flow:
                raise RuntimeError(f"Không tạo được device flow: {flow}")
            print(flow["message"], flush=True)
            result = app.acquire_token_by_device_flow(flow)
        if cache.has_state_changed:
            s.token_cache_path.write_text(cache.serialize(), encoding="utf-8")

    if "access_token" not in result:
        raise RuntimeError(f"Lấy token thất bại: {result.get('error')}: {result.get('error_description')}")
    return result["access_token"]


def from_sharepoint(s: Settings) -> SourceFile:
    token = _get_token(s)
    headers = {"Authorization": f"Bearer {token}"}
    item_url = f"{GRAPH}/shares/{_share_id(s.sharepoint_url)}/driveItem"

    meta = requests.get(item_url, headers=headers, timeout=60)
    meta.raise_for_status()
    item = meta.json()

    content = requests.get(f"{item_url}/content", headers=headers, timeout=300)
    content.raise_for_status()

    s.download_dir.mkdir(parents=True, exist_ok=True)
    path = s.download_dir / item["name"]
    path.write_bytes(content.content)
    return SourceFile(path=path, name=item["name"], etag=item.get("eTag"), modified_at=item.get("lastModifiedDateTime"))


def fetch(s: Settings, local_override: str | None = None) -> SourceFile:
    local = local_override or s.source_file
    if local:
        return from_local(local)
    if s.sharepoint_url:
        return from_sharepoint(s)
    raise RuntimeError("Chưa cấu hình nguồn: đặt SOURCE_FILE hoặc SHAREPOINT_URL trong .env")
