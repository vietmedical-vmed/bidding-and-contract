"""Turn a raw report sheet into clean, JSON-safe records."""
import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import pandas as pd

# Column-name tokens (after slugify) that decide how a column is parsed.
DATE_TOKENS = {"ngay", "date", "thoi_diem", "thoi_gian"}
NUMBER_TOKENS = {"gia", "tien", "gia_tri", "thanh_tien", "don_gia", "so_luong", "sl", "khoi_luong", "doanh_so", "doanh_thu", "bao_lanh"}
# Status columns must *start* with one of these (e.g. "thang_co_kq_thau" is a month, not a status).
STATUS_PREFIXES = ("ket_qua", "trang_thai", "tinh_trang")

# Checked in order: first match wins. "khong trung" must be tested before "trung".
STATUS_RULES = [
    ("khong_nop", ["khong_nop", "khong_tham_du", "bo_thau", "khong_du_thau"]),
    ("huy", ["huy", "huy_thau"]),
    ("truot", ["khong_trung", "truot", "thua", "loai", "rot"]),
    ("cho_kq", ["chua", "cho", "dang", "chua_co"]),
    ("trung", ["trung", "trung_thau", "dat"]),
]

EXCEL_ERRORS = {"#REF!", "#N/A", "#VALUE!", "#DIV/0!", "#NAME?", "#NUM!", "#NULL!"}
TOTAL_LABELS = {"tong", "tong_cong", "cong", "total", "grand_total"}
DATE_FORMATS = ["%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y-%m-%d", "%d/%m/%y", "%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"]


def slugify(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value)).replace("đ", "d").replace("Đ", "D")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _has_token(slug: str, tokens: set[str] | list[str]) -> bool:
    padded = f"_{slug}_"
    return any(f"_{t}_" in padded for t in tokens)


def _is_blank(v: object) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    return isinstance(v, str) and not v.strip()


def parse_number(v: object) -> float | int | None:
    if _is_blank(v):
        return None
    if isinstance(v, bool):
        raise ValueError(v)
    if isinstance(v, (int, float)):
        return v
    text = re.sub(r"(?i)vn[dđ]|đ|\s| ", "", str(v))
    if text in {"", "-", "--"}:
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    if "." in text and "," in text:
        # The separator that appears last is the decimal mark.
        thousands, decimal = (".", ",") if text.rfind(",") > text.rfind(".") else (",", ".")
        text = text.replace(thousands, "").replace(decimal, ".")
    elif "." in text or "," in text:
        sep = "." if "." in text else ","
        parts = text.split(sep)
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            text = text.replace(sep, "")  # 1.234.567 or 1,234 -> thousands separators
        else:
            text = text.replace(",", ".")
    number = float(text)
    number = -number if negative else number
    return int(number) if number.is_integer() else number


def parse_date(v: object) -> str | None:
    if _is_blank(v):
        return None
    if isinstance(v, (datetime, pd.Timestamp)):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (int, float)) and 20000 < v < 80000:  # Excel serial date
        return (datetime(1899, 12, 30) + timedelta(days=float(v))).date().isoformat()
    text = str(v).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(v)


def normalize_status(v: object) -> str | None:
    # A formula returning 0 means "no result yet" in this report.
    if _is_blank(v) or str(v).strip() == "0":
        return None
    slug = slugify(v)
    for status, keywords in STATUS_RULES:
        if _has_token(slug, keywords):
            return status
    return "khac"


def parse_text(v: object) -> object:
    if _is_blank(v):
        return None
    if isinstance(v, str):
        return re.sub(r"\s+", " ", v).strip()
    if isinstance(v, (datetime, pd.Timestamp, date)):
        return parse_date(v)
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def detect_header_row(raw: pd.DataFrame, max_scan: int = 30) -> int:
    """Index of the first row that looks like a header (mostly text cells)."""
    counts = [sum(isinstance(c, str) and c.strip() != "" for c in row) for row in raw.head(max_scan).itertuples(index=False)]
    best = max(counts, default=0)
    for i, n in enumerate(counts):
        if n >= max(2, 0.6 * best):
            return i
    return 0


def build_headers(row: list[object]) -> list[str]:
    headers, seen = [], {}
    for i, cell in enumerate(row, start=1):
        name = slugify(cell) if not _is_blank(cell) else f"col_{i}"
        name = name or f"col_{i}"
        seen[name] = seen.get(name, 0) + 1
        headers.append(name if seen[name] == 1 else f"{name}_{seen[name]}")
    return headers


def column_kind(name: str) -> str:
    if name.startswith(STATUS_PREFIXES):
        return "status"
    if _has_token(name, DATE_TOKENS):
        return "date"
    if _has_token(name, NUMBER_TOKENS):
        return "number"
    return "text"


@dataclass
class CleanResult:
    sheet: str
    header_row: int  # 1-based, as shown in Excel
    columns: dict[str, str]  # column -> kind
    records: list[dict] = field(default_factory=list)
    issues: list[dict] = field(default_factory=list)
    dropped_total_rows: int = 0
    skipped_rows: int = 0  # filtered out by business rules (e.g. package/lot rows)


def clean_sheet(raw: pd.DataFrame, sheet: str, header_row: int | None = None) -> CleanResult:
    raw = raw.dropna(how="all").dropna(axis=1, how="all")
    header_idx = header_row - 1 if header_row else detect_header_row(raw)
    header_pos = raw.index.get_loc(header_idx) if header_row else header_idx
    headers = build_headers(list(raw.iloc[header_pos]))
    body = raw.iloc[header_pos + 1 :]

    kinds = {h: column_kind(h) for h in headers}
    parsers = {"date": parse_date, "number": parse_number, "text": parse_text, "status": parse_text}
    result = CleanResult(sheet=sheet, header_row=int(raw.index[header_pos]) + 1, columns=kinds)

    for excel_idx, row in zip(body.index, body.itertuples(index=False)):
        excel_row = int(excel_idx) + 1
        first = next((c for c in row if not _is_blank(c)), None)
        if first is None:
            continue
        if isinstance(first, str) and slugify(first) in TOTAL_LABELS:
            result.dropped_total_rows += 1
            continue

        record: dict = {}
        for col, value in zip(headers, row):
            kind = kinds[col]
            if isinstance(value, str) and value.strip() in EXCEL_ERRORS:
                record[col] = None
                result.issues.append({"sheet": sheet, "excel_row": excel_row, "column": col, "kind": kind, "value": value})
                continue
            try:
                record[col] = parsers[kind](value)
            except (ValueError, TypeError):
                record[col] = None
                result.issues.append({"sheet": sheet, "excel_row": excel_row, "column": col, "kind": kind, "value": str(value)})
            if kind == "status":
                record[f"{col}_chuan"] = normalize_status(value)

        # Omit empty cells: keeps the jsonb payload small (the report has many blank columns).
        record = {k: v for k, v in record.items() if v is not None}
        if record:
            record["_source_row"] = excel_row
            result.records.append(record)

    return result
