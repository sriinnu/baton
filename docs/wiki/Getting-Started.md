# Getting started

```sh
npm i -g @sriinnu/baton                                    # Node >= 20, zero dependencies
git clone https://github.com/sriinnu/baton.git ~/code/baton   # only for the Claude plugin / Codex skills
cd your-repo && baton init                                 # creates .baton/ (ignored via .git/info/exclude)
```

Leaving: `baton handover --name auth-fix`, then the agent fills the prose.
Arriving: `baton takeover auth-fix --name auth-fix-2`.

Claude Code plugin: `claude plugin marketplace add ~/code/baton` then `claude plugin install baton@sriinnu-baton`; restart the app.
Codex: copy the skills to `~/.codex/skills/` (see README) or [`codex/*.md`](https://github.com/sriinnu/baton/tree/master/codex) to `~/.codex/prompts/`. No `notify` line: baton runs only when called.
Picking up a session nobody handed over: `baton takeover codex "<thread name>"`, `baton takeover claude last`, add `--distill` to have the cheap model write the brief.
Any other agent: paste [`rules/AGENTS.snippet.md`](https://github.com/sriinnu/baton/blob/master/rules/AGENTS.snippet.md) into its rules file.
