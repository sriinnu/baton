# Safety

- Transcripts are untrusted data and never executed.
- Redacted before writing or sending to a model: `sk-…` keys, `ghp_…` tokens, `AKIA…`, `Bearer …`, private key blocks.
- Git is called with argv only, never a shell string.
- `.baton/` is gitignored; commit it deliberately to share briefs.
- baton installs no hooks and runs only when called; a model is called only by `sync` or `takeover --distill`.
