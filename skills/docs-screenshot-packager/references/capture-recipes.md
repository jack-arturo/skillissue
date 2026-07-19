# Capture Recipes

Use this reference before planning capture state, redactions, and visual QA.

## Product State Selection

- Capture the state that proves the feature, not the default screen by habit.
- Vary important configuration states across a release set when that helps users
  understand the product.
- Hide graph labels, tooltips, cursors, or overlays when they obscure the UI.
- Use real stable data when the docs are about production behavior, but never at
  the cost of privacy or secrets.

## Privacy And Redaction

- Tokens must never appear in URLs, filenames, manifests, reports, metadata, or
  screenshots.
- When booting from a hash-token URL, persist safe local auth state before
  redacting the hash; otherwise a later React state change may reopen token
  prompts.
- Audit rendered UI text, not just API rows. Search panels and inspectors can
  append local or neighbor data that was not in the primary API response.
- Check screenshot bytes for known tokens when a token was used during capture.

## Browser Choices

- Public/local web pages: Playwright, Browser plugin, or in-app browser.
- Authenticated SaaS/dashboard pages: `dev-browser`.
- WebGL/canvas apps: wait for API responses, page idle/settle, and nonblank
  canvas pixels or image entropy before capture.

## Visual QA

- Open the generated image before committing it.
- Verify text remains readable at the intended docs display width.
- Reject screenshots with giant labels, cropped controls, blank canvases, or
  sensitive-looking text.
- Keep approval packages in scratch until the treatment is approved.
