# /// script
# requires-python = ">=3.11"
# dependencies = ["jsonschema>=4.0"]
# ///
"""Shared helpers for brand-bible-author validators.

The brief schema below mirrors `brief-schema.md`. If the schema doc evolves,
update this dict in lockstep — validate_references.py checks file presence,
not schema/doc parity.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

SKILL_DIR = Path(__file__).resolve().parent.parent

BRIEF_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["title", "project_dir", "divergent_session_path"],
    "additionalProperties": True,
    "properties": {
        "title": {"type": "string", "minLength": 1},
        "project_dir": {"type": "string", "pattern": r"^/"},
        "divergent_session_path": {"type": "string", "pattern": r"^/"},
        "moodboard_dir": {"type": "string", "pattern": r"^/"},
        "released_art_paths": {
            "type": "array",
            "items": {"type": "string", "pattern": r"^/"},
        },
        "voice_references": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "object",
                "required": ["reference", "why_it_lands", "kind"],
                "properties": {
                    "reference": {"type": "string", "minLength": 1},
                    "why_it_lands": {"type": "string", "minLength": 1},
                    "kind": {"enum": ["thesis", "visual", "vocabulary"]},
                },
            },
        },
        "iteration_notes_path": {"type": "string"},
        "max_voice_references": {"type": "integer", "minimum": 1, "maximum": 10},
        "irony_layers": {"type": "boolean"},
        "audience_required": {"type": "boolean"},
        "min_do_not_cross_lines": {"type": "integer", "minimum": 1},
        "notes": {"type": "string"},
    },
}


def list_h2_sections(md: str) -> list[str]:
    """Return list of H2 headings from a markdown string, in order, stripped."""
    return [m.group(1).strip() for m in re.finditer(r"(?m)^##\s+(.+?)\s*$", md)]


def has_h2_prefix(sections: list[str], prefix: str) -> bool:
    """True if any H2 section begins with the given prefix (case-sensitive)."""
    return any(s.startswith(prefix) for s in sections)


def count_bullets_under(md: str, heading_prefix: str) -> int:
    """Count bullet lines (`- ...`) under the first H2 heading whose text starts
    with heading_prefix. Stops at the next H2 or H3 boundary."""
    pattern = re.compile(
        rf"(?ms)^##\s+{re.escape(heading_prefix)}.*?\n(.*?)(?=^##\s|^---\s*$|\Z)"
    )
    m = pattern.search(md)
    if not m:
        return 0
    body = m.group(1)
    return len(re.findall(r"(?m)^- ", body))


def count_table_rows(md: str, after_heading_prefix: str) -> int:
    """Count data rows in the first markdown table after a heading whose text
    starts with after_heading_prefix. Excludes header row + separator row."""
    pattern = re.compile(
        rf"(?ms)^##\s+{re.escape(after_heading_prefix)}.*?\n(.*?)(?=^##\s|\Z)"
    )
    m = pattern.search(md)
    if not m:
        return 0
    body = m.group(1)
    rows = [ln for ln in body.splitlines() if ln.strip().startswith("|")]
    if len(rows) < 3:
        return 0
    return len(rows) - 2  # subtract header + separator


def find_referenced_filenames(md: str, pattern: str) -> list[str]:
    """Find all filenames matching pattern (regex) inside backticks in the md."""
    rx = re.compile(rf"`({pattern})`")
    return sorted(set(rx.findall(md)))


def emit(result: dict[str, Any], json_mode: bool) -> int:
    """Emit a result dict and return its exit code."""
    if json_mode:
        json.dump(result, sys.stdout, separators=(",", ":"))
        sys.stdout.write("\n")
    else:
        status = "PASS" if result.get("ok") else "FAIL"
        sys.stdout.write(f"[{status}] {result.get('check', '?')}\n")
        for line in result.get("messages", []):
            sys.stdout.write(f"  {line}\n")
    return 0 if result.get("ok") else 1
