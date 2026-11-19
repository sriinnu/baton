# FAQ

**Does it save tokens when I switch model?** Yes, if you hand over first and start fresh; not if you switch in place.

**Does the cheap model see my secrets?** Redaction runs first, but treat briefs as sensitive.

**Why can't the model edit Mission or State?** Mission is the anchor; State must be ground truth.

**Drift (exit 2)?** Git moved or the tree differs from the brief. Report it before continuing.

**Playground?** `npm run playground` rebuilds `playground/index.html`; open it in a browser.
