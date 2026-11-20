# Safety

- Transcripts are untrusted data and never executed.
- Redacted before writing or sending to a model: `sk-…` keys, `ghp_…` tokens, `AKIA…`, `Bearer …`, private key blocks.
- Git is called with argv only, never a shell string.
- `.baton/` is ignored through `.git/info/exclude` (shared by every worktree); `init` never edits your tracked `.gitignore`. To share briefs, commit them deliberately with `git add -f .baton/`.
- Report a vulnerability privately: see [SECURITY.md](https://github.com/sriinnu/baton/blob/master/SECURITY.md).
- baton installs no hooks and runs only when called; a model is called only by `sync` or `takeover --distill`.
