# Changelog

All notable changes to baton are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Changed
- **baton runs only when called.** The plugin's `Stop`/`PreCompact`/`SubagentStop` hooks and the Codex `notify` setup are gone, along with per-turn sync and pending-brief adoption. The agent writes the brief at handover from its warm cache; a model is called only by `baton sync <ref>` or `takeover --distill`. `sync --hook` is a silent no-op, so an old hook line cannot break an agent.
- `handover` binds the brief to the writing session (`CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID`) so `sync` can refresh it later.
- `sync` reads the conversation itself (user and agent text, one line per tool, failure tails) instead of the skeleton, in parts of ~60k chars with one model call each; past ~360k chars it keeps the first goal and the most recent activity.

### Added
- `baton takeover [claude|codex] <ref>`: `<ref>` can be a session id, id prefix, a session name (Codex thread name, Claude Code title; exact match first, newest wins; an ambiguous partial lists candidates), or `last` (the newest session whose cwd is this repo). A session with no brief gets one from the extract; `--distill` fills it with one cheap-model pass over the whole session.
- Archived Codex threads (`~/.codex/archived_sessions/*.jsonl.zst`) are found and read (Node ≥ 22.15).
- `baton doctor`.
- `baton takeover` prints a `--- switch ---` block: previous vs new provider and model, old session context vs brief size, tokens not re-sent cold (estimate), and cache read/write totals from the old transcript.
- `--model` and `--provider` options. Briefs record the model that wrote them (`model:` in the frontmatter). The skills pass the agent's own model id.
- Session readers report the model that produced a transcript (Claude Code and Codex).
- README: "How to use it" table (CLI vs desktop app); plugin-only install needs just Node 20+, upload route, switch block, and desktop-app guidance (new task, not the model picker).
- MIT `LICENSE`, `CHANGELOG.md`, author and repository metadata, `development` category.
- `npm run pack:plugin` builds `dist/baton-plugin.zip` for the claude.ai "Upload a plugin" dialog.

### Changed
- The CLI now lives in `plugin/` (`plugin/cli/`, `plugin/src/`) so the plugin is self-contained: no `npm link`, only Node 20+. Root `package.json` `bin` points to `plugin/cli/baton.js`.
- Hooks and skills run the bundled CLI through `${CLAUDE_PLUGIN_ROOT}`.

### Fixed
- Upload rejected the archive: the plugin manifest was not at the zip root, and claude.ai refuses a top-level `bin/` folder (renamed to `cli/`).

## [0.1.0] - 2026-11-19

### Added
- Distilled, inheritable briefs: `init`, `write`/`handover`, `show`/`gist`, `takeover`, `child`, `fold`, `ls`, `check`, `sync`.
- Git-checked state (drift detection) and a `verify` command per brief.
- Session readers for Claude Code and Codex, plus a generic `--path` reader.
- Claude Code plugin: `handover`, `switch` and `takeover` skills; Stop, PreCompact and SubagentStop sync hooks.
- Codex integration (`codex/`, `rules/AGENTS.snippet.md`) and a browser playground.
