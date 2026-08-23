# Evaluation rubric

Score each grid image from 0–2 on subject fidelity, composition, style, palette, and negative constraints. A negative-constraint violation is an automatic miss. Record one dominant failure mode per miss: `composition-drift`, `subject-drift`, `style-drift`, `palette-drift`, `negative-violation`, `anatomical-incoherence`, `text-gibberish`, `watermark-or-stamp`, or `rate-limit`.

A round wins when at least `min_hits_per_round_to_win` images pass. Stop early after `min_hits_to_stop` accumulated hits, or hard-stop at `max_rounds`.
