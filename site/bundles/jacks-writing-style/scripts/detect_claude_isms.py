#!/usr/bin/env python3
"""Detect Claude-isms and un-Jack-like patterns in writing."""
import sys
import re
import json

# Patterns that indicate Claude, not Jack
CLAUDE_ISMS = [
    (r'\bhow can i help\b', "Claude phrase: 'How can I help'"),
    (r'\bhere\'s how you can\b', "Claude phrase: 'Here's how you can'"),
    (r'\bi\'d be happy to\b', "Claude phrase: 'I'd be happy to'"),
    (r'\blet me walk you through\b', "Claude phrase: 'Let me walk you through'"),
    (r'\bit\'s worth noting\b', "Hedging: 'It's worth noting'"),
    (r'\byou might want to\b', "Hedging: 'You might want to'"),
    (r'\byou could potentially\b', "Hedging: 'You could potentially'"),
    (r'\bperhaps consider\b', "Hedging: 'Perhaps consider'"),
    (r'\bit may be worth\b', "Hedging: 'It may be worth'"),
    (r'\bapologies for\b', "Claude apologizing"),
    (r'\bsorry for\b', "Claude apologizing"),
    (r'\bsynergy\b', "Corporate buzzword: 'synergy'"),
    (r'\bleverage\b', "Corporate buzzword: 'leverage'"),
    (r'\bcircle back\b', "Corporate buzzword: 'circle back'"),
    (r'\btouch base\b', "Corporate buzzword: 'touch base'"),
    (r'\bmoving forward\b', "Corporate buzzword: 'moving forward'"),
    (r'\bbest practices dictate\b', "Corporate buzzword: 'best practices dictate'"),
    (r'\bat the end of the day\b', "Corporate buzzword: 'at the end of the day'"),
    (r'\bwould you like me to\b', "Permission seeking"),
    (r'\bshall i\b', "Permission seeking"),
    (r'\bcan i help you\b', "Permission seeking"),
    (r'\bas you (know|can see|might expect)\b', "Unnecessary filler"),
    (r'\bit\'s important to note\b', "Unnecessary filler"),
    (r'\bobviously\b', "Unnecessary filler"),
    (r'\bbasically\b', "Unnecessary filler"),
]

# Good patterns (Jack's style)
JACK_PATTERNS = [
    (r'\bthat\'s it!', "Jack exclamation"),
    (r'\bgo wild\b', "Jack encouragement"),
    (r'\bjust do\b', "Jack imperative"),
    (r'\bno .+ hell\b', "Jack dismissiveness"),
    (r'\bfuck\b', "Jack profanity (appropriate)"),
    (r'\bhot mess\b', "Jack honesty"),
    (r'—', "Jack em dash"),
    (r'✅|❌|🎯|🔥|⚡', "Jack emojis"),
]

def analyze_text(text):
    """Analyze text for Claude-isms and Jack patterns."""
    lines = text.split('\n')
    issues = []
    good_patterns = []
    
    for line_num, line in enumerate(lines, 1):
        line_lower = line.lower()
        
        # Check for Claude-isms
        for pattern, description in CLAUDE_ISMS:
            if re.search(pattern, line_lower, re.IGNORECASE):
                issues.append({
                    "line": line_num,
                    "type": "claude_ism",
                    "description": description,
                    "text": line.strip()
                })
        
        # Check for Jack patterns
        for pattern, description in JACK_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                good_patterns.append({
                    "line": line_num,
                    "type": "jack_pattern",
                    "description": description
                })
    
    # Check for passive voice indicators
    passive_indicators = [
        r'\b(is|was|were|are|been|being) \w+(ed|en)\b',
        r'\bcan be done by\b',
        r'\bshould be noted\b',
        r'\bmay be used\b'
    ]
    
    for line_num, line in enumerate(lines, 1):
        for pattern in passive_indicators:
            if re.search(pattern, line, re.IGNORECASE):
                # Skip code blocks
                if line.strip().startswith('```') or line.strip().startswith('//') or line.strip().startswith('#'):
                    continue
                issues.append({
                    "line": line_num,
                    "type": "passive_voice",
                    "description": "Passive voice detected",
                    "text": line.strip()
                })
                break
    
    return issues, good_patterns

def calculate_score(issues, good_patterns, total_lines):
    """Calculate Jack-ness score (0-100)."""
    # Start at 100
    score = 100.0
    
    # Deduct for issues
    for issue in issues:
        if issue["type"] == "claude_ism":
            score -= 10  # Major deduction
        elif issue["type"] == "passive_voice":
            score -= 2   # Minor deduction
    
    # Bonus for Jack patterns
    jack_bonus = min(len(good_patterns) * 2, 20)  # Max 20 bonus points
    score += jack_bonus
    
    # Normalize to 0-100
    score = max(0, min(100, score))
    
    return score

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: detect_claude_isms.py <file>"
        }))
        sys.exit(1)
    
    try:
        file_path = sys.argv[1]
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
        
        issues, good_patterns = analyze_text(text)
        total_lines = len(text.split('\n'))
        score = calculate_score(issues, good_patterns, total_lines)
        
        result = {
            "file": file_path,
            "total_lines": total_lines,
            "jack_score": round(score, 1),
            "issues_found": len(issues),
            "jack_patterns_found": len(good_patterns),
            "status": "PASS" if score >= 80 else "NEEDS_WORK" if score >= 60 else "FAIL",
            "issues": issues[:10],  # First 10 issues
            "jack_patterns": good_patterns[:5]  # First 5 good patterns
        }
        
        print(json.dumps(result, indent=2))
        sys.exit(0 if score >= 80 else 1)
        
    except FileNotFoundError:
        print(json.dumps({
            "error": f"File not found: {sys.argv[1]}"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "error": f"Unexpected error: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()

