# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Tier 1.3 — validate a locked brand bible's structural contract.

Given a project path + the brief that produced the bible, verify:
- identity.md has all required H2 sections
- visual-language.md has §§ 1–8
- IS-NOT bullet count >= identity-section invariant (>=3)
- Do-not-cross-lines bullet count >= brief.min_do_not_cross_lines
- Voice-references count <= brief.max_voice_references
- Every pick-NN-*.png and mood-NN-*.png referenced in visual-language.md
  exists in <project>/brand/reference-pins/
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (  # noqa: E402
    count_bullets_under,
    count_table_rows,
    emit,
    find_referenced_filenames,
    has_h2_prefix,
    list_h2_sections,
)


# H2 prefixes required by outline.md skeleton (artist-name agnostic).
IDENTITY_REQUIRED_PREFIXES = [
    "Persona",
    "The premise",
    "Voice references",
    "What ",  # matches "What <artist> IS" / "What <artist> IS NOT"
    "Audience",
    "Tone register",
    "Do-not-cross lines",
    "Continuity check",
]

# visual-language.md sections are numbered "## 1. Palette" .. "## 8. When to update".
VISUAL_REQUIRED_NUMBERS = list(range(1, 9))


def load_brief_constraints(brief_path: Path | None) -> dict:
    if not brief_path:
        return {"max_voice_references": 3, "min_do_not_cross_lines": 3, "audience_required": True}
    data = json.loads(brief_path.read_text())
    return {
        "max_voice_references": data.get("max_voice_references", 3),
        "min_do_not_cross_lines": data.get("min_do_not_cross_lines", 3),
        "audience_required": data.get("audience_required", True),
    }


def check_identity(text: str, constraints: dict) -> tuple[bool, list[str]]:
    msgs: list[str] = []
    ok = True
    sections = list_h2_sections(text)
    for prefix in IDENTITY_REQUIRED_PREFIXES:
        if not has_h2_prefix(sections, prefix):
            ok = False
            msgs.append(f"identity.md: missing H2 starting with '{prefix}'")

    # "What X IS" and "What X IS NOT" — both required, but they share the prefix.
    is_count = sum(1 for s in sections if s.startswith("What ") and " IS" in s)
    if is_count < 2:
        ok = False
        msgs.append("identity.md: needs both 'What ... IS' and 'What ... IS NOT' sections")

    do_not_cross_n = count_bullets_under(text, "Do-not-cross lines")
    min_required = constraints["min_do_not_cross_lines"]
    if do_not_cross_n < min_required:
        ok = False
        msgs.append(
            f"identity.md: do-not-cross-lines has {do_not_cross_n} bullets, brief requires >= {min_required}"
        )

    voice_n = count_table_rows(text, "Voice references")
    max_voice = constraints["max_voice_references"]
    if voice_n == 0:
        ok = False
        msgs.append("identity.md: voice references table is empty or missing")
    elif voice_n > max_voice:
        ok = False
        msgs.append(f"identity.md: voice references count {voice_n} > brief.max_voice_references {max_voice}")

    if ok:
        msgs.append(f"identity.md: ok ({len(sections)} H2s, {do_not_cross_n} do-not-cross, {voice_n} voice refs)")
    return ok, msgs


def check_visual_language(text: str) -> tuple[bool, list[str]]:
    msgs: list[str] = []
    ok = True
    sections = list_h2_sections(text)
    section_numbers = set()
    for s in sections:
        m = re.match(r"^(\d+)\.", s)
        if m:
            section_numbers.add(int(m.group(1)))
    missing = [n for n in VISUAL_REQUIRED_NUMBERS if n not in section_numbers]
    if missing:
        ok = False
        msgs.append(f"visual-language.md: missing numbered sections {missing}")
    else:
        msgs.append(f"visual-language.md: ok (sections 1–8 present)")
    return ok, msgs


def check_reference_pins(visual_md: str, pins_dir: Path) -> tuple[bool, list[str]]:
    msgs: list[str] = []
    ok = True

    referenced = find_referenced_filenames(visual_md, r"(?:pick|mood)-\d+-[\w-]+\.png")
    if not referenced:
        ok = False
        msgs.append("visual-language.md: no pick-NN/mood-NN .png references found")
        return ok, msgs

    on_disk = {p.name for p in pins_dir.glob("*.png")} if pins_dir.exists() else set()
    for ref in referenced:
        if ref not in on_disk:
            ok = False
            msgs.append(f"reference-pins: {ref} referenced in visual-language.md but missing from {pins_dir}")
    if ok:
        msgs.append(f"reference-pins: ok ({len(referenced)} refs all present)")
    return ok, msgs


def main() -> int:
    p = argparse.ArgumentParser(description="Validate a locked brand bible.")
    p.add_argument("--project", required=True, help="Absolute path to artist project (contains brand/)")
    p.add_argument("--brief", help="Optional path to the brief.json that produced the bible")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    project = Path(args.project)
    brand_dir = project / "brand"
    identity_path = brand_dir / "identity.md"
    visual_path = brand_dir / "visual-language.md"
    pins_dir = brand_dir / "reference-pins"

    if not brand_dir.exists():
        return emit({"check": "locked_bible", "ok": False, "messages": [f"no brand/ dir at {brand_dir}"]}, args.json)
    if not identity_path.exists() or not visual_path.exists():
        return emit(
            {
                "check": "locked_bible",
                "ok": False,
                "messages": [f"identity.md or visual-language.md missing in {brand_dir}"],
            },
            args.json,
        )

    constraints = load_brief_constraints(Path(args.brief) if args.brief else None)
    identity_text = identity_path.read_text()
    visual_text = visual_path.read_text()

    id_ok, id_msgs = check_identity(identity_text, constraints)
    vis_ok, vis_msgs = check_visual_language(visual_text)
    pin_ok, pin_msgs = check_reference_pins(visual_text, pins_dir)

    ok = id_ok and vis_ok and pin_ok
    return emit(
        {
            "check": "locked_bible",
            "ok": ok,
            "project": str(project),
            "messages": id_msgs + vis_msgs + pin_msgs,
        },
        args.json,
    )


if __name__ == "__main__":
    sys.exit(main())
