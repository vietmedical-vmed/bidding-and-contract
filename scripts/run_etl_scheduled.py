"""Entry point for the "Bidding ETL" scheduled task.

Run with pythonw.exe so no console window opens every time the task fires.
Output is appended to logs/etl-YYYYMMDD.log; the ETL itself skips unchanged sheets.
"""
import os
import sys
import traceback
import warnings
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
warnings.simplefilter("ignore")  # openpyxl data-validation warnings, same as `-W ignore`

(ROOT / "logs").mkdir(exist_ok=True)
now = datetime.now()
log = open(ROOT / "logs" / f"etl-{now:%Y%m%d}.log", "a", encoding="utf-8")
# pythonw has no stdout/stderr; send both to the log (main() reconfigures stdout, which a file supports).
sys.stdout = sys.stderr = log

print(f"===== {now:%Y-%m-%d %H:%M:%S} (scheduled)", flush=True)
try:
    from etl.__main__ import main

    sys.argv = [sys.argv[0]]
    rc = main()
except SystemExit as exc:
    rc = exc.code if isinstance(exc.code, int) else 1
except Exception:
    traceback.print_exc()
    rc = 1
print(f"===== exit code {rc}", flush=True)
log.close()
sys.exit(rc)
