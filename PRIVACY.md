# Privacy policy

This policy covers baton: the `@sriinnu/baton` CLI on npm, the `baton` plugin for Claude Code and Codex, and the `agent-baton` plugin in Anthropic's plugin directory. Last updated 2026-11-21.

## The short version

baton runs on your machine. I run no server, collect nothing and see nothing. There is no telemetry, analytics, account or tracking.

## What baton reads

When you, or an agent on your behalf, run a baton command, it reads:

- session transcripts that your coding agents have already saved on your machine (`~/.claude/projects`, `~/.codex/sessions`). These can contain anything you or the agent wrote, including names, email addresses or code. baton treats them as data and never executes them.
- your git repository, through the `git` command (branch, commit, changed files and the uncommitted diff).

## What baton writes

- handover briefs and an index, in a `.baton/` folder inside your repository. `baton init` keeps that folder out of git through `.git/info/exclude`, so briefs are not committed or pushed unless you choose to.
- before anything is written to a brief or sent to a model, baton redacts what looks like a secret: API keys, access tokens, bearer tokens, JWTs, private keys and `password=`-style values. Redaction is pattern-based, so it can miss an unusual secret. Read a brief before sharing it.

Briefs stay on your disk until you delete them. Removing `.baton/` removes everything baton stored.

## What leaves your machine

baton itself makes no network requests. Two optional commands ask a model for help:

- `baton sync`
- `baton takeover --distill`

They do not call any API directly. They pass the redacted session text to your own `claude` or `codex` command-line tool, which sends it to Anthropic or OpenAI under your account and that provider's terms and privacy policy. Nothing goes anywhere else, and nothing is sent unless you run one of those two commands.

Installing baton from npm, GitHub or a plugin marketplace is handled by those services under their own policies.

## Commands that run code

baton runs the `verify:` command written in a brief's State section (for example `npm test`) only when you pass `--run` to `baton check`. It runs in your repository, as you. Without `--run` (including during `takeover`), baton only shows the command. Read a brief from someone else before you pass `--run`.

## Children

baton is a developer tool and is not directed at children under 18.

## Changes and contact

Changes to this policy are made in this file, so its git history is the record. Questions: open an issue at https://github.com/sriinnu/baton/issues, or report a security problem privately as described in [SECURITY.md](SECURITY.md).
