"""Runtime settings read from environment / .env."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


@dataclass(frozen=True)
class Settings:
    source_file: str | None
    sharepoint_url: str | None
    tenant_id: str | None
    client_id: str | None
    client_secret: str | None
    sheets: list[str]
    header_row: int | None
    product_catalog_file: str | None
    supabase_url: str | None
    supabase_key: str | None
    token_cache_path: Path = ROOT / ".token_cache.json"
    download_dir: Path = ROOT / "data"
    out_dir: Path = ROOT / "out"


def load_settings() -> Settings:
    sheets = _env("SHEETS")
    header_row = _env("HEADER_ROW")
    return Settings(
        source_file=_env("SOURCE_FILE"),
        sharepoint_url=_env("SHAREPOINT_URL"),
        tenant_id=_env("AZURE_TENANT_ID"),
        client_id=_env("AZURE_CLIENT_ID"),
        client_secret=_env("AZURE_CLIENT_SECRET"),
        sheets=[s.strip() for s in sheets.split(",") if s.strip()] if sheets else [],
        header_row=int(header_row) if header_row else None,
        product_catalog_file=_env("PRODUCT_CATALOG_FILE"),
        supabase_url=(_env("SUPABASE_URL") or "").rstrip("/") or None,
        supabase_key=_env("SUPABASE_SECRET_KEY"),
    )
