#!/usr/bin/env python3
"""A stand-in model provider that records what a harness sends. Speaks enough of the OpenAI
chat completions API to answer every request, streamed or not, and logs one JSON line per
request: the model, each user, assistant and tool message as the harness sent it, the context
files a system message names ("Instructions from: <path>"), and what it answered. Never logs
headers, so no key reaches the log, and never logs a system message whole.

A user message holding REPLY=<word> is answered with <word>, and any other with "OK.", so the
final message is a known value. FAIL=<status> answers with that HTTP status and no reply.
RUNPWD is answered first with a call to the harness's shell tool running `pwd`, so the next
request shows where the harness ran it.

    standin.py <port> <log.jsonl>
"""
import json, re, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT, LOG = int(sys.argv[1]), sys.argv[2]


def log(rec):
    with open(LOG, "a") as f:
        f.write(json.dumps(rec) + "\n")


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return ""


def last_user(msgs):
    i = max((i for i, m in enumerate(msgs) if m.get("role") == "user"), default=-1)
    return i, (text_of(msgs[i].get("content")) if i >= 0 else "")


def shell_tool(body, msgs):
    """The shell tool's name when the last user message asks for RUNPWD and no tool result has
    come back since it; otherwise None."""
    i, text = last_user(msgs)
    if "RUNPWD" not in text or any(m.get("role") == "tool" for m in msgs[i + 1:]):
        return None
    names = [(t.get("function") or {}).get("name") for t in body.get("tools") or []]
    return next((n for n in names if n and n.lower() == "bash"), None)


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _sse(self, chunks):
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "close")
        self.end_headers()
        self.close_connection = True
        for c in chunks:
            self.wfile.write(b"data: " + json.dumps(c).encode() + b"\n\n")
            self.wfile.flush()
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()

    def do_GET(self):
        if self.path.rstrip("/").endswith("/models"):
            return self._json(200, {"object": "list", "data": [{"id": m, "object": "model"} for m in ("standin-a", "standin-b")]})
        return self._json(404, {"error": {"message": "not here"}})

    def do_POST(self):
        n = int(self.headers.get("content-length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            body = {}
        if not self.path.split("?")[0].endswith("/chat/completions"):
            return self._json(404, {"error": {"message": "not here"}})
        msgs = body.get("messages") or []
        system = "\n".join(text_of(m.get("content")) for m in msgs if m.get("role") == "system")
        _, text = last_user(msgs)
        fail = re.search(r"FAIL=(\d{3})", text)
        tool = None if fail else shell_tool(body, msgs)
        reply = None if fail or tool else (re.search(r"REPLY=([A-Za-z0-9_-]+)", text) or [None, "OK."])[1]
        log({"model": body.get("model"), "tools": len(body.get("tools") or []),
             "instructions": re.findall(r"Instructions from: (\S+)", system),
             "messages": [{"role": m.get("role"), "text": text_of(m.get("content"))} for m in msgs if m.get("role") != "system"],
             "status": int(fail.group(1)) if fail else 200, "tool_call": "pwd" if tool else None, "reply": reply})
        if fail:
            return self._json(int(fail.group(1)), {"error": {"message": "the stand-in was asked to fail", "type": "invalid_request_error"}})
        cid, created, model = "chatcmpl-" + uuid.uuid4().hex[:12], int(time.time()), body.get("model", "standin")
        usage = {"prompt_tokens": 100, "completion_tokens": 2, "total_tokens": 102}
        def chunk(delta, finish=None, usage=None):
            c = {"id": cid, "object": "chat.completion.chunk", "created": created, "model": model,
                 "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
            if usage:
                c["usage"] = usage
            return c
        if tool:
            call = {"index": 0, "id": "call_" + uuid.uuid4().hex[:8], "type": "function",
                    "function": {"name": tool, "arguments": json.dumps({"command": "pwd", "description": "Print the working directory"})}}
            return self._sse([chunk({"role": "assistant", "content": None, "tool_calls": [call]}), chunk({}, "tool_calls", usage)])
        if not body.get("stream"):
            return self._json(200, {"id": cid, "object": "chat.completion", "created": created, "model": model,
                                    "choices": [{"index": 0, "message": {"role": "assistant", "content": reply}, "finish_reason": "stop"}],
                                    "usage": usage})
        self._sse([chunk({"role": "assistant", "content": ""}), chunk({"content": reply}), chunk({}, "stop", usage)])


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
