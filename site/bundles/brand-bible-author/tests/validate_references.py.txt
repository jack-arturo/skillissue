# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Tier 1.2 — verify every relative file reference in SKILL.md exists.

Looks for backtick-wrapped paths matching known patterns:
- *.md (sibling files like outline.md, coherence-check.md, brief-schema.md)
- examples/*.json
- bin/*
- tests/* (if SKILL.md cross-references the test layer)
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import SKILL_DIR, emit  # noqa: E402


# Captures `path/to/file.md`, `examples/foo.brief.json`, `bin/coherence-lint`, etc.
# Intentionally conservative: only matches paths inside backticks.
REF_PATTERN = re.compile(
    r"`("
    r"(?:examples|bin|tests)/[\w./-]+"  # explicit subdir prefixes
    r"|"
    r"[\w-]+\.md"  # sibling .md files
    r")`"
)

# References that should be ignored (external paths, vault-absolute).
IGNORE_PREFIXES = ("/", "~", "http://", "https://")

# Filenames that look like sibling .md but actually name artifacts the skill
# *produces* in an artist's project (not files that should exist in the skill dir).
ARTIFACT_FILENAMES = frozenset({"identity.md", "visual-language.md"})


def main() -> int:
    p = argparse.ArgumentParser(description="Verify SKILL.md relative references.")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    skill_md = SKILL_DIR / "SKILL.md"
    text = skill_md.read_text()

    raw_refs = sorted(set(REF_PATTERN.findall(text)))
    refs = [
        r for r in raw_refs
        if not r.startswith(IGNORE_PREFIXES) and r not in ARTIFACT_FILENAMES
    ]

    messages: list[str] = []
    ok = True

    for ref in refs:
        target = SKILL_DIR / ref
        if target.exists():
            messages.append(f"{ref}: ok")
        else:
            ok = False
            messages.append(f"{ref}: MISSING (expected at {target})")

    if not refs:
        messages.append("no relative references found in SKILL.md (suspicious)")

    return emit(
        {"check": "references", "ok": ok, "messages": messages, "count": len(refs)},
        args.json,
    )


if __name__ == "__main__":
    sys.exit(main())
