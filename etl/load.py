"""Write cleaned records to Supabase through its REST API (PostgREST)."""
import json
from datetime import datetime, timezone

import requests

from .config import Settings


class Supabase:
    def __init__(self, s: Settings):
        if not (s.supabase_url and s.supabase_key):
            raise RuntimeError("Thiếu SUPABASE_URL / SUPABASE_SECRET_KEY trong .env")
        self.base = f"{s.supabase_url}/rest/v1"
        self.headers = {"apikey": s.supabase_key, "Content-Type": "application/json"}
        if s.supabase_key.startswith("eyJ"):  # legacy JWT service_role key
            self.headers["Authorization"] = f"Bearer {s.supabase_key}"

    def _req(self, method: str, path: str, **kwargs) -> requests.Response:
        headers = {**self.headers, **kwargs.pop("headers", {})}
        resp = requests.request(method, f"{self.base}/{path}", headers=headers, timeout=300, **kwargs)
        if not resp.ok:
            raise RuntimeError(f"Supabase {method} {path} -> {resp.status_code}: {resp.text[:500]}")
        return resp

    def sheet_hashes(self) -> dict[str, str]:
        resp = self._req("GET", "bid_sheets", params={"select": "sheet_name,content_hash"})
        return {row["sheet_name"]: row["content_hash"] for row in resp.json()}

    def start_run(self, source_name: str, etag: str | None, modified_at: str | None) -> int:
        resp = self._req(
            "POST",
            "bid_sync_runs",
            headers={"Prefer": "return=representation"},
            json={"source_name": source_name, "source_etag": etag, "source_modified_at": modified_at},
        )
        return resp.json()[0]["id"]

    def replace_sheet(self, run_id: int, sheet: str, content_hash: str, records: list[dict]) -> int:
        payload = {"p_run_id": run_id, "p_sheet": sheet, "p_hash": content_hash, "p_rows": records}
        resp = self._req(
            "POST",
            "rpc/replace_stg_bid_rows",
            data=json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"),
        )
        return resp.json()

    def finish_run(self, run_id: int, status: str, row_count: int = 0, issue_count: int = 0, error: str | None = None) -> None:
        self._req(
            "PATCH",
            "bid_sync_runs",
            params={"id": f"eq.{run_id}"},
            json={
                "status": status,
                "row_count": row_count,
                "issue_count": issue_count,
                "error": error,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            },
        )
