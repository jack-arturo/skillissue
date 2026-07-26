#!/usr/bin/env python3
"""Validate a VoiceInk Settings Backup JSON before import.

Checks structural shape, Mode/prompt wiring, and common 2.0 footguns:
- AI Enhancement enabled with empty selectedPrompt
- No default Mode
- selectedPrompt UUIDs that don't exist in customPrompts
- Apple Speech still selected as transcription model (warn)

Exit codes:
  0 = ok (warnings allowed)
  1 = hard errors
  2 = usage / unreadable file
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REQUIRED_TOP = (
    "version",
    "modeConfigs",
    "customPrompts",
    "wordReplacements",
    "vocabularyWords",
)

MODE_REQUIRED = (
    "id",
    "name",
    "isAIEnhancementEnabled",
    "selectedTranscriptionModelName",
)


def _warn(msg: str, warnings: list[str]) -> None:
    warnings.append(msg)
    print(f"WARN  {msg}", file=sys.stderr)


def _err(msg: str, errors: list[str]) -> None:
    errors.append(msg)
    print(f"ERROR {msg}", file=sys.stderr)


def validate(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    for key in REQUIRED_TOP:
        if key not in data:
            _err(f"missing top-level key: {key}", errors)

    if errors:
        return errors, warnings

    version = data.get("version")
    if version not in ("2.0", 2, "2"):
        _warn(f"unexpected version={version!r} (expected '2.0')", warnings)

    modes = data.get("modeConfigs")
    prompts = data.get("customPrompts")
    replacements = data.get("wordReplacements")
    vocab = data.get("vocabularyWords")

    if not isinstance(modes, list) or not modes:
        _err("modeConfigs must be a non-empty list", errors)
    if not isinstance(prompts, list):
        _err("customPrompts must be a list", errors)
    if not isinstance(replacements, dict):
        _err("wordReplacements must be an object/map", errors)
    if not isinstance(vocab, list):
        _err("vocabularyWords must be a list", errors)

    if errors:
        return errors, warnings

    prompt_ids = {
        p.get("id") for p in prompts if isinstance(p, dict) and p.get("id")
    }
    if not prompt_ids:
        _warn("customPrompts has no prompt ids — enhancing Modes will fail", warnings)

    defaults = [m for m in modes if isinstance(m, dict) and m.get("isDefault")]
    if not defaults:
        _err("no Mode with isDefault=true", errors)
    elif len(defaults) > 1:
        names = ", ".join(str(m.get("name")) for m in defaults)
        _warn(f"multiple default Modes: {names}", warnings)

    for i, mode in enumerate(modes):
        if not isinstance(mode, dict):
            _err(f"modeConfigs[{i}] is not an object", errors)
            continue
        label = mode.get("name") or mode.get("id") or f"#{i}"
        for key in MODE_REQUIRED:
            if key not in mode:
                _err(f"Mode {label!r}: missing {key}", errors)

        enhance = bool(mode.get("isAIEnhancementEnabled"))
        prompt = mode.get("selectedPrompt")
        model = str(mode.get("selectedTranscriptionModelName") or "")

        if enhance:
            if not prompt:
                _err(
                    f"Mode {label!r}: AI Enhancement on but selectedPrompt is empty "
                    "(History will show prompt=<none> and decode failures)",
                    errors,
                )
            elif prompt not in prompt_ids:
                _err(
                    f"Mode {label!r}: selectedPrompt {prompt!r} not in customPrompts",
                    errors,
                )

        if "apple" in model.lower() or model.lower() in {
            "speech",
            "applespeech",
            "apple speech",
        }:
            _warn(
                f"Mode {label!r}: transcription model looks like Apple Speech "
                f"({model!r}) — 'Download required for English (United States)' risk",
                warnings,
            )

        if mode.get("selectedAIProvider") == "Custom" and not mode.get(
            "selectedAIModel"
        ):
            _warn(
                f"Mode {label!r}: Custom provider with empty selectedAIModel",
                warnings,
            )

    emoji_keys = [k for k in replacements if "emoji" in str(k).lower()]
    if not emoji_keys:
        _warn(
            "wordReplacements has no '*emoji*' keys — Brief Modes won't convert "
            "spoken emoji without AI",
            warnings,
        )

    ellipsis_keys = {"dot dot dot", "ellipsis", "three dots"}
    if not (ellipsis_keys & set(map(str, replacements.keys()))):
        _warn(
            "wordReplacements missing ellipsis spoken forms "
            "(dot dot dot / ellipsis / three dots)",
            warnings,
        )

    print(
        f"OK shape: {len(modes)} modes, {len(prompts)} prompts, "
        f"{len(replacements)} replacements, {len(vocab)} vocab"
    )
    return errors, warnings


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(
            f"Usage: {Path(sys.argv[0]).name} <VoiceInk_Settings_Export.json>",
            file=sys.stderr,
        )
        return 2

    path = Path(argv[1]).expanduser()
    if not path.is_file():
        print(f"ERROR file not found: {path}", file=sys.stderr)
        return 2

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR invalid JSON: {exc}", file=sys.stderr)
        return 2

    if not isinstance(data, dict):
        print("ERROR top-level JSON must be an object", file=sys.stderr)
        return 1

    errors, warnings = validate(data)
    if errors:
        print(f"FAILED: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASSED: 0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
