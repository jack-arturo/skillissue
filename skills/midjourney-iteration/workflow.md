# Round contract

For each round, attach to the already logged-in Midjourney tab, inspect the accessible UI, submit one prompt, wait for the grid, and save a screenshot to the session directory. Evaluate all four candidates against `eval-rubric.md`, append prompt and scores to `eval-notes.jsonl`, then either stop or apply one recipe from `refine-patterns.md`.

Do not run unattended farms, scrape third-party work, or keep submitting if screenshot evaluation is unavailable. Return the top three candidates, their prompts, and the saved session location.
