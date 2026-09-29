#!/usr/bin/env python3
"""Detect Claude-isms, dash abuse, and un-Jack-like patterns in a draft."""
import json
import re
import sys

EM_DASH = "\u2014"
EN_DASH = "\u2013"

# Phrase / vocab tells. Keep these high-precision; structural checks are separate.
CLAUDE_ISMS = [
    (r"\bhow can i help\b", "Chat: 'How can I help'"),
    (r"\bhere'?s how you can\b", "Chat: 'Here's how you can'"),
    (r"\bi'?d be happy to\b", "Chat: 'I'd be happy to'"),
    (r"\blet me walk you through\b", "Chat: 'Let me walk you through'"),
    (r"\blet me break this down\b", "Chat: 'Let me break this down'"),
    (r"\blet'?s (dive|explore|unpack|take a look)\b", "Signposting: let's dive/explore/unpack"),
    (r"\bnow let'?s (turn|look|dive)\b", "Signposting: now let's..."),
    (r"\bit'?s worth noting\b", "Throat-clearing: 'It's worth noting'"),
    (r"\bit is worth noting\b", "Throat-clearing: 'It is worth noting'"),
    (r"\bit'?s important to (note|remember|understand)\b", "Throat-clearing: 'It's important to...'"),
    (r"\bit should be noted\b", "Throat-clearing: 'It should be noted'"),
    (r"\byou might want to\b", "Hedge on action: 'You might want to'"),
    (r"\byou could potentially\b", "Hedge on action: 'You could potentially'"),
    (r"\bperhaps consider\b", "Hedge on action: 'Perhaps consider'"),
    (r"\bit may be worth\b", "Hedging: 'It may be worth'"),
    (r"\bit could be helpful to\b", "Hedge on action: 'It could be helpful to'"),
    (r"\bapologies for\b", "Chat apology"),
    (r"\bsorry for the (confusion|inconvenience)\b", "Chat apology"),
    (r"\bhope this helps\b", "Chat closer: 'Hope this helps'"),
    (r"\bgreat question\b", "Chat: 'Great question'"),
    (r"\byou'?re absolutely right\b", "Chat: 'You're absolutely right'"),
    (r"\bwould you like me to\b", "Permission seeking"),
    (r"\bshall i\b", "Permission seeking"),
    (r"\bas you (know|can see|might expect)\b", "Filler: 'As you know'"),
    (r"\bobviously\b", "Filler: 'obviously'"),
    (r"\bbasically\b", "Filler: 'basically'"),
    (r"\bhere'?s the thing\b", "Fake authenticity: 'Here's the thing'"),
    (r"\bhere'?s the truth\b", "Fake authenticity: 'Here's the truth'"),
    (r"\blet me be clear\b", "Fake authenticity: 'Let me be clear'"),
    (r"\bwhy this matters\b", "Section-header tell: 'Why this matters'"),
    (r"\bthe key takeaway\b", "Recap closer: 'the key takeaway'"),
    (r"\bone thing is clear\b", "Recap closer: 'one thing is clear'"),
    (r"\bin today'?s\b", "Scene-set: 'In today's...'"),
    (r"\bin an era of\b", "Scene-set: 'In an era of'"),
    (r"\bwhen it comes to\b", "Throat-clearing: 'when it comes to'"),
    (r"\bat its core\b", "Throat-clearing: 'at its core'"),
    (r"\bin conclusion\b", "Recap: 'In conclusion'"),
    (r"\bin summary\b", "Recap: 'In summary'"),
    (r"\bwithout further ado\b", "Throat-clearing"),
    (r"\bit'?s not just\b", "Formula contrast: 'It's not just X'"),
    (r"\bit is not just\b", "Formula contrast: 'It is not just X'"),
    (r"\bnot only .+, but also\b", "Formula contrast: 'Not only X, but also Y'"),
    (r"\bit'?s not about\b", "Formula contrast: 'It's not about X'"),
    (r"\bplays a (crucial|critical|key|important) role\b", "Padding: 'plays a role'"),
    (r"\bserves as\b", "Copula dodge: 'serves as'"),
    (r"\bstands as\b", "Copula dodge: 'stands as'"),
    (r"\ba testament to\b", "Puffery: 'testament'"),
    (r"\bin the realm of\b", "Poetic: 'in the realm of'"),
    (r"\bin the (digital )?landscape\b", "Poetic: 'landscape'"),
    (r"\bthis raises (important )?questions\b", "Essayistic closer"),
    (r"\binherent tensions\b", "Claude vocab: 'inherent tensions'"),
    (r"\bsynerg(y|ies)\b", "Corporate: synergy"),
    (r"\bleverage\b", "Corporate: leverage"),
    (r"\bcircle back\b", "Corporate: circle back"),
    (r"\btouch base\b", "Corporate: touch base"),
    (r"\bmoving forward\b", "Corporate: moving forward"),
    (r"\bat the end of the day\b", "Corporate: at the end of the day"),
    (r"\bfurthermore\b", "Formal connective"),
    (r"\bmoreover\b", "Formal connective"),
    (r"\bconsequently\b", "Formal connective"),
    (r"\bnonetheless\b", "Formal connective"),
    (r"\bnevertheless\b", "Formal connective"),
    (r"\bdelve\b", "Inflated verb: delve"),
    (r"\btapestry\b", "Poetic noun: tapestry"),
    (r"\bparadigm\b", "Poetic noun: paradigm"),
    (r"\bgroundbreaking\b", "Promotional: groundbreaking"),
    (r"\bcutting-edge\b", "Promotional: cutting-edge"),
    (r"\bgame-chang(?:er|ing)\b", "Promotional: game-changer"),
    (r"\bseamless(?:ly)?\b", "Promotional: seamless"),
    (r"\bmultifaceted\b", "Promotional: multifaceted"),
    (r"\bholistic\b", "Promotional: holistic"),
    (r"\bpivotal\b", "Promotional: pivotal"),
    (r"\bfoster(?:ing|s)?\b", "Inflated verb: foster"),
    (r"\bharness(?:ing|es)?\b", "Inflated verb: harness"),
    (r"\butilize\b", "Inflated verb: utilize"),
    (r"\bunderscore[sd]?\b", "Inflated verb: underscore"),
    (r"\bfundamentally\b", "Claude adverb: fundamentally"),
    (r"\bin essence\b", "Claude: in essence"),
    (r"\bessentially\b", "Filler: essentially"),
    (r"\bi think that\b", "Narrator-I: 'I think that'"),
    (r"\bi (find|notice|feel|believe|realize) that\b", "Narrator-I"),
]

# Jack-flavored texture. Bonus only; never treat punctuation as a plus.
JACK_PATTERNS = [
    (r"\bthat'?s it!", "Jack exclamation"),
    (r"\bgo wild\b", "Jack encouragement"),
    (r"\bjust do\b", "Jack imperative"),
    (r"\bno .+ hell\b", "Jack dismissiveness"),
    (r"\bfuck\b", "Jack profanity"),
    (r"\bhot mess\b", "Jack honesty"),
    (r"\bcheap insurance\b", "Jack phrase"),
    (r"\bship it\b", "Jack imperative"),
]


def _is_skippable_line(line):
    stripped = line.strip()
    if stripped.startswith("```") or stripped.startswith("//"):
        return True
    if stripped in ("---", "***", "___"):
        return True
    if stripped.startswith("✗") or "✗" in stripped[:4]:
        return True
    return False


def analyze_text(text):
    lines = text.split("\n")
    issues = []
    good_patterns = []
    in_fence = False

    dash_count = text.count(EM_DASH) + text.count(EN_DASH)

    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or _is_skippable_line(line):
            continue

        if EM_DASH in line:
            issues.append(
                {
                    "line": line_num,
                    "type": "dash",
                    "description": "Em dash (Claude punctuation tell)",
                    "text": stripped,
                }
            )
        if EN_DASH in line:
            issues.append(
                {
                    "line": line_num,
                    "type": "dash",
                    "description": "En dash (same family as em dash)",
                    "text": stripped,
                }
            )
        if re.search(r"\s--\s", line) and not stripped.startswith("-"):
            issues.append(
                {
                    "line": line_num,
                    "type": "dash",
                    "description": "Spaced '--' used as an em-dash dodge",
                    "text": stripped,
                }
            )

        line_lower = line.lower()
        for pattern, description in CLAUDE_ISMS:
            if re.search(pattern, line_lower, re.IGNORECASE):
                issues.append(
                    {
                        "line": line_num,
                        "type": "claude_ism",
                        "description": description,
                        "text": stripped,
                    }
                )

        for pattern, description in JACK_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                good_patterns.append(
                    {
                        "line": line_num,
                        "type": "jack_pattern",
                        "description": description,
                    }
                )

    sentences = [
        s.strip()
        for s in re.split(r"[.!?]+", re.sub(r"```[\s\S]*?```", " ", text))
        if s.strip() and len(s.split()) >= 3
    ]
    word_counts = [len(s.split()) for s in sentences]
    metronome_runs = 0
    run = 0
    for count in word_counts:
        if 17 <= count <= 23:
            run += 1
            if run == 3:
                metronome_runs += 1
        else:
            run = 0
    if metronome_runs:
        issues.append(
            {
                "line": 0,
                "type": "cadence",
                "description": (
                    f"Cadence: {metronome_runs} run(s) of 3+ sentences in the 17-23 word band"
                ),
                "text": "",
            }
        )

    colon_count = len(re.findall(r":", text))
    word_count = max(len(text.split()), 1)
    if word_count >= 200 and colon_count > (word_count / 250):
        issues.append(
            {
                "line": 0,
                "type": "colon_density",
                "description": (
                    f"Colon density: {colon_count} colons in {word_count} words "
                    "(Claude substitutes colons for dashes)"
                ),
                "text": "",
            }
        )

    return issues, good_patterns, dash_count


def calculate_score(issues, good_patterns):
    score = 100.0
    for issue in issues:
        kind = issue["type"]
        if kind == "dash":
            score -= 8
        elif kind == "claude_ism":
            score -= 8
        elif kind in ("cadence", "colon_density"):
            score -= 6
        else:
            score -= 3
    jack_bonus = min(len(good_patterns) * 2, 12)
    score += jack_bonus
    return max(0, min(100, score))


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: detect_claude_isms.py <file>"}))
        sys.exit(1)

    file_path = sys.argv[1]
    try:
        with open(file_path, encoding="utf-8") as handle:
            text = handle.read()
    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)

    issues, good_patterns, dash_count = analyze_text(text)
    total_lines = len(text.split("\n"))
    score = calculate_score(issues, good_patterns)
    result = {
        "file": file_path,
        "total_lines": total_lines,
        "jack_score": round(score, 1),
        "dash_count": dash_count,
        "issues_found": len(issues),
        "jack_patterns_found": len(good_patterns),
        "status": "PASS" if score >= 80 and dash_count == 0 else "NEEDS_WORK" if score >= 60 else "FAIL",
        "issues": issues[:25],
        "jack_patterns": good_patterns[:8],
    }
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()
