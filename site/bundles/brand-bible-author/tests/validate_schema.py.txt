# /// script
# requires-python = ">=3.11"
# dependencies = ["jsonschema>=4.0"]
# ///
"""Tier 1.1 — validate every examples/*.brief.json against BRIEF_SCHEMA."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import BRIEF_SCHEMA, SKILL_DIR, emit  # noqa: E402

import jsonschema  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="Validate skill briefs against schema.")
    p.add_argument("--json", action="store_true", help="Emit JSON result")
    args = p.parse_args()

    examples_dir = SKILL_DIR / "examples"
    briefs = sorted(examples_dir.glob("*.brief.json"))
    messages: list[str] = []
    ok = True

    if not briefs:
        ok = False
        messages.append(f"no *.brief.json files found in {examples_dir}")

    validator = jsonschema.Draft7Validator(BRIEF_SCHEMA)
    for brief_path in briefs:
        try:
            data = json.loads(brief_path.read_text())
        except json.JSONDecodeError as e:
            ok = False
            messages.append(f"{brief_path.name}: invalid JSON — {e.msg} at line {e.lineno}")
            continue
        errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
        if errors:
            ok = False
            for err in errors:
                path = ".".join(str(p) for p in err.absolute_path) or "(root)"
                messages.append(f"{brief_path.name}: {path} — {err.message}")
        else:
            messages.append(f"{brief_path.name}: ok ({len(data)} fields)")

    return emit({"check": "schema", "ok": ok, "messages": messages, "count": len(briefs)}, args.json)


if __name__ == "__main__":
    sys.exit(main())
