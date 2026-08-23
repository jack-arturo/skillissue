# Brief schema

Use a JSON brief. `subject`, `composition`, and `style` are required; the rest keep a loop bounded and reviewable.

```json
{
  "title": "Product hero study",
  "output_dir": "./sessions/midjourney",
  "subject": "a translucent reusable water bottle",
  "composition": "top-down on a pale work surface",
  "style": "precise editorial product photography",
  "palette": "soft blue and warm white",
  "negative": "text, logos, extra objects",
  "references": ["https://example.com/reference.jpg"],
  "max_rounds": 6,
  "min_hits_to_stop": 3,
  "min_hits_per_round_to_win": 2,
  "starting_prompt": ""
}
```

`output_dir` is optional. If omitted, use `${XDG_STATE_HOME:-$HOME/.local/state}/midjourney-iteration/`. References are described in the prompt; this workflow does not upload or scrape images.
