#!/usr/bin/env python3
"""A stand-in model provider that streams at a set pace, to measure what a harness spends while
it waits on its model. Speaks enough of the OpenAI chat completions API for MiMo Code. The last
user message of the agent's own turn (a request that offers tools and holds no assistant message
yet) sets its pace; every other request is answered "OK." at once:

  WAIT=<s>   hold the stream open, sending nothing, for <s> seconds
  RATE=<n>   then stream <n> deltas a second of a few characters each, for SECS=<s> seconds (60)

Logs one JSON line per request: when it arrived, the model, whether it was the agent's turn, the
pace, the deltas sent, and when the stream began and ended. Never logs a header or a message.

    standin.py <port> <log.jsonl>
"""
import json, re, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT, LOG = int(sys.argv[1]), sys.argv[2]


def text_of(c):
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return "".join(p.get("text", "") for p in c if isinstance(p, dict))
    return ""


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
        if self.path.rstrip("/").endswith("/models"):
            return self._json(200, {"object": "list", "data": [{"id": "standin-a", "object": "model"}]})
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
        users = [text_of(m.get("content")) for m in msgs if m.get("role") == "user"]
        turn = bool(body.get("tools")) and not any(m.get("role") == "assistant" for m in msgs)
        pace = {k: float(v) for k, v in re.findall(r"\b(WAIT|RATE|SECS)=([0-9.]+)", users[-1] if users else "")} if turn else {}
        cid, created, model = "chatcmpl-" + uuid.uuid4().hex[:12], int(time.time()), body.get("model", "standin")
        usage = {"prompt_tokens": 100, "completion_tokens": 2, "total_tokens": 102}
        rec = {"at": time.time(), "model": body.get("model"), "agent_turn": turn, "pace": pace, "deltas": 0}

        def chunk(delta, finish=None, usage=None):
            c = {"id": cid, "object": "chat.completion.chunk", "created": created, "model": model,
                 "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
            if usage:
                c["usage"] = usage
            return b"data: " + json.dumps(c).encode() + b"\n\n"

        if not body.get("stream"):
            rec["stream_start"] = rec["end"] = time.time()
            self._log(rec)
            return self._json(200, {"id": cid, "object": "chat.completion", "created": created, "model": model,
                                    "choices": [{"index": 0, "message": {"role": "assistant", "content": "OK."}, "finish_reason": "stop"}],
                                    "usage": usage})
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "close")
        self.end_headers()
        self.close_connection = True
        w = self.wfile
        w.write(chunk({"role": "assistant", "content": ""}))
        w.flush()
        time.sleep(pace.get("WAIT", 0))
        rate, secs = pace.get("RATE", 0), pace.get("SECS", 60)
        rec["stream_start"] = time.time()
        if rate > 0:
            t0, i = time.time(), 0
            while time.time() - t0 < secs:
                w.write(chunk({"content": "tok%d " % (i % 1000)}))
                w.flush()
                i += 1
                time.sleep(max(0, t0 + i / rate - time.time()))
            rec["deltas"] = i
        else:
            w.write(chunk({"content": "OK."}))
        w.write(chunk({}, "stop", usage))
        w.write(b"data: [DONE]\n\n")
        w.flush()
        rec["end"] = time.time()
        self._log(rec)

    def _log(self, rec):
        with open(LOG, "a") as f:
            f.write(json.dumps(rec) + "\n")


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
