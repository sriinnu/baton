# Security

## Reporting a vulnerability

Please report it privately through GitHub: **Security → Report a vulnerability** on
[sriinnu/baton](https://github.com/sriinnu/baton/security/advisories/new). Don't open a public issue.

Include what you ran, what happened, and the baton version (`npm ls -g @sriinnu/baton`).
You'll get a reply within a week. A fix ships as a patch release, credited to you
unless you'd rather not be named.

## Supported versions

Only the latest release on npm (`@sriinnu/baton`) gets fixes.

## What baton treats as a security bug

baton reads agent session transcripts and writes briefs that other agents read. Bugs here include:

- A secret (API key, token, private key) that reaches a brief or a model call unredacted.
- Transcript content that gets executed, or that changes what baton runs.
- Git or model commands built from transcript text rather than argv.
- A brief handed to the wrong session, or a git check that passes on state it should reject.
- Anything in the release path that could publish a package without the maintainer's 2FA approval.

## How releases are protected

There is no npm token. CI only *stages* a version through npm trusted publishing with
provenance. It goes live only after the maintainer approves it with 2FA. Release tags
must be signed `v*` tags, and the `npm` environment requires the maintainer's review.
