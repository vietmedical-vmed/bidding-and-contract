"""Business rules for the "So lieu <year>" sheets: keep item rows only and add the product group."""
import csv

import openpyxl

from .clean import CleanResult
from .config import ROOT

DROP_COLUMNS = {"stt", "stt_2", "hs_code", "hang"}
# "Phân loại" in the bid report uses short codes; this file maps them to the
# product groups ("Nhóm sản phẩm") of the master product catalog.
MAPPING_FILE = ROOT / "mapping" / "phan_loai_nhom_san_pham.csv"
CATALOG_GROUP_SHEET = "Danh mục Nhóm sản phẩm"


def load_mapping() -> dict[str, str]:
    with open(MAPPING_FILE, encoding="utf-8-sig", newline="") as f:
        return {row["phan_loai"].strip(): row["nhom_san_pham"].strip() for row in csv.DictReader(f)}


def load_catalog_groups(path: str) -> dict[str, str]:
    """Product group -> BU from the master product catalog."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    groups = {}
    for row in wb[CATALOG_GROUP_SHEET].iter_rows(min_row=2, values_only=True):
        bu, group = row[0], row[1]
        if group and str(group).strip():
            groups[str(group).strip()] = str(bu).strip() if bu else None
    wb.close()
    return groups


def check_mapping(mapping: dict[str, str], groups: dict[str, str]) -> list[str]:
    """Mapping targets that are not product groups in the catalog."""
    return sorted({g for g in mapping.values() if g not in groups})


def is_item_row(record: dict) -> bool:
    # Package rows have no item name; lot rows have a name but no model, quantity or result.
    if "danh_muc_hang" not in record:
        return False
    return any(k in record for k in ("model", "so_luong", "ket_qua_thau", "gia_trung_thau"))


def to_items(result: CleanResult, mapping: dict[str, str], groups: dict[str, str]) -> CleanResult:
    items = []
    for record in result.records:
        if not is_item_row(record):
            continue
        item = {k: v for k, v in record.items() if k not in DROP_COLUMNS}

        phan_loai = item.get("phan_loai")
        if phan_loai is not None:
            group = mapping.get(phan_loai)
            if group:
                item["nhom_san_pham"] = group
                if groups.get(group):
                    item["bu"] = groups[group]
            else:
                result.issues.append(
                    {"sheet": result.sheet, "excel_row": item["_source_row"], "column": "phan_loai", "kind": "mapping", "value": phan_loai}
                )
        items.append(item)

    result.columns = {k: v for k, v in result.columns.items() if k not in DROP_COLUMNS}
    result.skipped_rows = len(result.records) - len(items)
    result.records = items
    return result
