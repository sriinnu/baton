"""Writes the synthetic Claude Code session the demo takes over from.
Shaped like a real transcript (model id, per-message usage); the usage is illustrative,
sized like a session that ran out of context."""
import json, sys
f, cwd, sid = sys.argv[1:]
n, ctx = [0], [150000]
def u(c): return {"type": "user", "cwd": cwd, "sessionId": sid, "isSidechain": False, "message": {"role": "user", "content": c}}
def a(c):
    n[0] += 1; ctx[0] += 6500
    return {"type": "assistant", "cwd": cwd, "sessionId": sid, "isSidechain": False, "message": {"id": f"msg_{n[0]:03d}", "role": "assistant", "model": "claude-opus-5-5", "content": c,
            "usage": {"input_tokens": 900, "cache_read_input_tokens": ctx[0] - 3400, "cache_creation_input_tokens": 2500, "output_tokens": 400}}}
def tool(i, nm, inp): return a([{"type": "tool_use", "id": i, "name": nm, "input": inp}])
def res(i, t): return u([{"type": "tool_result", "tool_use_id": i, "content": t}])
rows = [u("Users get logged out right after a password reset. Fix it without breaking SSO."),
        a([{"type": "text", "text": "Reading the auth code."}]), tool("t1", "Read", {"file_path": cwd + "/src/auth.js"}), res("t1", "export function isExpired(...)"),
        a([{"type": "text", "text": "isExpired compares a UTC timestamp with local time. Fixing that."}]),
        tool("t2", "Edit", {"file_path": cwd + "/src/auth.js", "old_string": "now.getTime()", "new_string": "Date.UTC(...)"}), res("t2", "ok"),
        tool("t3", "Bash", {"command": "npm test"}), res("t3", "Error: 2 tests failed\n  test/auth.test.js: expected false, got true (hard-coded local date)"),
        u("use key sk-live-4f9a8b7c6d5e4f3a2b1c for staging if you need it"),  # fake key: shows redaction
        a([{"type": "text", "text": "The 2 failures are tests that hard-code a local date. Next: make them UTC, then run the SSO suite."}])]
open(f, "w").write("\n".join(json.dumps(r) for r in rows) + "\n")
