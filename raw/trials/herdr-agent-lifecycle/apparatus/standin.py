#!/usr/bin/env python3
"""A stand-in model provider for timing trials. Speaks just enough of the OpenAI chat
completions API (for pi) and the Anthropic messages API (for claude) to answer every
request with a fixed text reply, streamed. Logs one JSON line per request: when it arrived,
when the reply finished, the path, and the tail of the last user message. Never logs headers.

A user message containing SLEEP=<seconds> delays the reply, to hold the harness in a
working turn. PAD=<kb> pads the reply with that many KB of text, to grow a session.

    standin.py <port> <log.jsonl>
"""
import json, re, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT, LOG = int(sys.argv[1]), sys.argv[2]


def now_ms():
    return int(time.time() * 1000)


def log(rec):
    with open(LOG, "a") as f:
        f.write(json.dumps(rec) + "\n")


def last_user_text(body):
    msgs = body.get("messages") or []
    for m in reversed(msgs):
        if m.get("role") != "user":
            continue
        c = m.get("content")
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            parts = [p.get("text", "") for p in c if isinstance(p, dict) and p.get("type") in ("text", "input_text")]
            if parts:
                return parts[-1]
    return ""


def knobs(text):
    s = re.search(r"SLEEP=(\d+(?:\.\d+)?)", text)
    p = re.search(r"PAD=(\d+)", text)
    return (float(s.group(1)) if s else 0.0), (int(p.group(1)) if p else 0)


def tool_plan(body, text):
    """TOOL=<seconds>x<count> in the user message: answer with a shell tool call running
    `sleep <seconds>` until <count> tool results follow that message, then answer in text.
    Returns (tool name, command) for the next call, or None for a text answer."""
    m = re.search(r"TOOL=(\d+(?:\.\d+)?)x(\d+)", text)
    if not m:
        return None
    secs, count = m.group(1), int(m.group(2))
    msgs = body.get("messages") or []
    # results since the last user message that carries text
    last_text = max((i for i, x in enumerate(msgs) if x.get("role") == "user" and (
        isinstance(x.get("content"), str) or any(isinstance(p, dict) and p.get("type") == "text" for p in x.get("content") or []))), default=-1)
    done = 0
    for x in msgs[last_text + 1:]:
        if x.get("role") == "tool":
            done += 1
        elif x.get("role") == "user" and isinstance(x.get("content"), list):
            done += sum(1 for p in x["content"] if isinstance(p, dict) and p.get("type") == "tool_result")
    if done >= count:
        return None
    names = [((t.get("function") or {}).get("name") or t.get("name")) for t in body.get("tools") or []]
    name = next((n for n in names if n and n.lower() == "bash"), None)
    return (name, "sleep %s" % secs) if name else None


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

    def do_GET(self):
        log({"t_in": now_ms(), "method": "GET", "path": self.path})
        if self.path.rstrip("/").endswith("/models"):
            return self._json(200, {"object": "list", "data": [{"id": "fixed", "object": "model"}]})
        return self._json(404, {"error": "not here"})

    def do_HEAD(self):
        self.send_response(200); self.send_header("content-length", "0"); self.end_headers()

    def do_POST(self):
        t_in = now_ms()
        n = int(self.headers.get("content-length") or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            body = {}
        path = self.path.split("?")[0]
        text = last_user_text(body)
        sleep, pad = knobs(text)
        rec = {"t_in": t_in, "method": "POST", "path": path, "model": body.get("model"),
               "stream": bool(body.get("stream")), "n_messages": len(body.get("messages") or []),
               "request_bytes": len(raw), "user_tail": text[-160:]}
        if path.endswith("/count_tokens"):
            rec["t_done"] = now_ms(); log(rec)
            return self._json(200, {"input_tokens": 100})
        if sleep:
            time.sleep(sleep)
        reply = "OK." + ((" " + "x" * 1023) * pad if pad else "")
        tool = tool_plan(body, text)
        rec["tool_call"] = tool[1] if tool else None
        if path.endswith("/chat/completions"):
            self.openai(body, reply, tool)
        elif path.endswith("/messages"):
            self.anthropic(body, reply, tool)
        else:
            rec["t_done"] = now_ms(); rec["status"] = 404; log(rec)
            return self._json(404, {"error": "not here"})
        rec["t_done"] = now_ms(); rec["reply_bytes"] = len(reply)
        log(rec)

    def sse_start(self):
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "close")
        self.end_headers()
        self.close_connection = True

    def openai(self, body, reply, tool=None):
        cid, created, model = "chatcmpl-" + uuid.uuid4().hex[:12], int(time.time()), body.get("model", "fixed")
        if tool and body.get("stream"):
            self.sse_start()
            def chunk(delta, finish=None):
                c = {"id": cid, "object": "chat.completion.chunk", "created": created, "model": model,
                     "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
                self.wfile.write(b"data: " + json.dumps(c).encode() + b"\n\n"); self.wfile.flush()
            chunk({"role": "assistant", "content": None, "tool_calls": [{"index": 0, "id": "call_" + uuid.uuid4().hex[:8], "type": "function",
                   "function": {"name": tool[0], "arguments": json.dumps({"command": tool[1]})}}]})
            chunk({}, "tool_calls")
            self.wfile.write(b"data: [DONE]\n\n"); self.wfile.flush()
            return
        if not body.get("stream"):
            return self._json(200, {"id": cid, "object": "chat.completion", "created": created, "model": model,
                                    "choices": [{"index": 0, "message": {"role": "assistant", "content": reply}, "finish_reason": "stop"}],
                                    "usage": {"prompt_tokens": 100, "completion_tokens": 2, "total_tokens": 102}})
        self.sse_start()
        def chunk(delta, finish=None, usage=None):
            c = {"id": cid, "object": "chat.completion.chunk", "created": created, "model": model,
                 "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
            if usage:
                c["usage"] = usage
            self.wfile.write(b"data: " + json.dumps(c).encode() + b"\n\n"); self.wfile.flush()
        chunk({"role": "assistant", "content": ""})
        chunk({"content": reply})
        chunk({}, "stop", {"prompt_tokens": 100, "completion_tokens": 2, "total_tokens": 102})
        self.wfile.write(b"data: [DONE]\n\n"); self.wfile.flush()

    def anthropic(self, body, reply, tool=None):
        mid, model = "msg_" + uuid.uuid4().hex[:20], body.get("model", "fixed")
        usage = {"input_tokens": 100, "output_tokens": 2, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}
        if tool and body.get("stream"):
            self.sse_start()
            def ev(name, data):
                self.wfile.write(("event: %s\ndata: %s\n\n" % (name, json.dumps(data))).encode()); self.wfile.flush()
            ev("message_start", {"type": "message_start", "message": {"id": mid, "type": "message", "role": "assistant", "model": model,
                                 "content": [], "stop_reason": None, "stop_sequence": None, "usage": usage}})
            ev("content_block_start", {"type": "content_block_start", "index": 0,
                                       "content_block": {"type": "tool_use", "id": "toolu_" + uuid.uuid4().hex[:20], "name": tool[0], "input": {}}})
            ev("content_block_delta", {"type": "content_block_delta", "index": 0,
                                       "delta": {"type": "input_json_delta", "partial_json": json.dumps({"command": tool[1]})}})
            ev("content_block_stop", {"type": "content_block_stop", "index": 0})
            ev("message_delta", {"type": "message_delta", "delta": {"stop_reason": "tool_use", "stop_sequence": None}, "usage": {"output_tokens": 2}})
            ev("message_stop", {"type": "message_stop"})
            return
        if not body.get("stream"):
            return self._json(200, {"id": mid, "type": "message", "role": "assistant", "model": model,
                                    "content": [{"type": "text", "text": reply}], "stop_reason": "end_turn",
                                    "stop_sequence": None, "usage": usage})
        self.sse_start()
        def ev(name, data):
            self.wfile.write(("event: %s\ndata: %s\n\n" % (name, json.dumps(data))).encode()); self.wfile.flush()
        ev("message_start", {"type": "message_start", "message": {"id": mid, "type": "message", "role": "assistant", "model": model,
                             "content": [], "stop_reason": None, "stop_sequence": None, "usage": usage}})
        ev("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}})
        ev("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": reply}})
        ev("content_block_stop", {"type": "content_block_stop", "index": 0})
        ev("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None}, "usage": {"output_tokens": 2}})
        ev("message_stop", {"type": "message_stop"})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
