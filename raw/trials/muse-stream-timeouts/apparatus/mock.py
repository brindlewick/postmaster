#!/usr/bin/env python3
"""Loopback mock of the Meta Responses API for Muse Code timeout trials.
Main requests (prompt_cache_key tbh:main...) get: created, in_progress, a reasoning item, then
--stall seconds of silence (optionally with SSE comment keepalives or reasoning summaries every
--every seconds), then a message "OK" and completed. Other requests (reminders) get an immediate
function call to muse.submit_reminder_decision with decision none. Logs one JSON line per
request and per stream end to --log. Never logs headers."""
import argparse, json, socketserver, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, required=True); ap.add_argument('--stall', type=float, default=0)
ap.add_argument('--mode', choices=['silent', 'keepalive', 'summary'], default='silent'); ap.add_argument('--every', type=float, default=10)
ap.add_argument('--log', required=True); ap.add_argument('--lead', type=float, default=0)
A = ap.parse_args()
lock = threading.Lock(); n = [0]
def log(**kw):
    kw['t'] = time.time()
    with lock, open(A.log, 'a') as f: f.write(json.dumps(kw) + '\n')
def resp(rid, status, output, created):
    return {"background": False, "created_at": created, "error": None, "id": rid, "incomplete_details": None, "instructions": "mock",
            "max_output_tokens": 128000, "model": "muse-spark-1.3-contributor", "object": "response", "output": output,
            "parallel_tool_calls": True, "reasoning": {"effort": "max", "summary": "auto"}, "status": status, "store": False,
            "temperature": 1.0, "text": {"format": {"type": "text"}}, "tool_choice": "auto", "tools": [], "top_p": 1.0,
            "usage": None if status != 'completed' else {"input_tokens": 10, "input_tokens_details": {"cached_tokens": 0},
                     "output_tokens": 2, "output_tokens_details": {"reasoning_tokens": 1}, "total_tokens": 12}}
class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def chunk(self, s):
        b = s.encode(); self.wfile.write(b'%x\r\n' % len(b) + b + b'\r\n'); self.wfile.flush()
    def ev(self, typ, data):
        self.seq += 1; data = dict(data); data['type'] = typ; data['sequence_number'] = self.seq
        self.chunk('event: %s\ndata: %s\n\n' % (typ, json.dumps(data)))
    def do_GET(self):
        log(kind='get', path=self.path); self.send_response(404); self.send_header('Content-Length', '0'); self.end_headers()
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0))
        try: j = json.loads(body)
        except Exception: j = {}
        key = j.get('prompt_cache_key', ''); main = key.startswith('tbh:main')
        with lock: n[0] += 1; k = n[0]
        rid = 'resp_mock%04d' % k; t0 = time.time(); created = float(int(t0)); self.seq = -1
        log(kind='request', n=k, path=self.path, key=key, main=main, effort=(j.get('reasoning') or {}).get('effort'), stream=j.get('stream'))
        self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.send_header('Cache-Control', 'no-cache')
        self.send_header('Transfer-Encoding', 'chunked'); self.end_headers()
        rs = {"id": "rs_%s:rs_1" % rid, "status": "in_progress", "summary": [], "type": "reasoning"}
        try:
            self.ev('response.created', {"response": resp(rid, 'in_progress', [], created)})
            self.ev('response.in_progress', {"response": resp(rid, 'in_progress', [], created)})
            self.ev('response.output_item.added', {"item": rs, "output_index": 0})
            summaries = []
            if main and A.stall > 0:
                end = t0 + A.stall; nxt = t0 + A.every
                while time.time() < end:
                    time.sleep(max(0, min(end, nxt) - time.time()))
                    if time.time() >= end: break
                    lead = time.time() - t0 < A.lead
                    if A.mode == 'keepalive' and not lead: self.chunk(': keepalive\n\n')
                    elif A.mode == 'summary' or lead:
                        i = len(summaries); txt = 'Thinking step %d.' % i; summaries.append(txt)
                        part = {"text": "", "type": "summary_text"}
                        self.ev('response.reasoning_summary_part.added', {"item_id": rs['id'], "output_index": 0, "part": part, "summary_index": i})
                        self.ev('response.reasoning_summary_text.delta', {"delta": txt, "item_id": rs['id'], "output_index": 0, "summary_index": i})
                        self.ev('response.reasoning_summary_text.done', {"item_id": rs['id'], "output_index": 0, "summary_index": i, "text": txt})
                        self.ev('response.reasoning_summary_part.done', {"item_id": rs['id'], "output_index": 0, "part": {"text": txt, "type": "summary_text"}, "summary_index": i})
                    nxt += A.every
            rdone = {"encrypted_content": "mock", "id": rs['id'], "status": "completed", "summary": [{"text": s, "type": "summary_text"} for s in summaries], "type": "reasoning"}
            self.ev('response.output_item.done', {"item": rdone, "output_index": 0})
            if main:
                mid = 'msg_%s' % rid
                self.ev('response.output_item.added', {"item": {"content": [], "id": mid, "role": "assistant", "status": "in_progress", "type": "message"}, "output_index": 1})
                self.ev('response.content_part.added', {"content_index": 0, "item_id": mid, "output_index": 1, "part": {"annotations": [], "logprobs": [], "text": "", "type": "output_text"}})
                self.ev('response.output_text.delta', {"content_index": 0, "delta": "OK", "item_id": mid, "logprobs": [], "output_index": 1})
                self.ev('response.content_part.done', {"content_index": 0, "item_id": mid, "output_index": 1, "part": {"annotations": [], "logprobs": [], "text": "OK", "type": "output_text"}})
                item = {"content": [{"annotations": [], "logprobs": [], "text": "OK", "type": "output_text"}], "id": mid, "role": "assistant", "status": "completed", "type": "message"}
                self.ev('response.output_item.done', {"item": item, "output_index": 1})
            else:
                fid = 'fc_%s' % rid; args = json.dumps({"decision": "none", "reason": "mock"})
                item = {"arguments": args, "call_id": "call_%s" % rid, "id": fid, "name": "muse.submit_reminder_decision", "status": "completed", "type": "function_call"}
                self.ev('response.output_item.added', {"item": dict(item, arguments="", status="in_progress"), "output_index": 1})
                self.ev('response.function_call_arguments.delta', {"delta": args, "item_id": fid, "output_index": 1})
                self.ev('response.function_call_arguments.done', {"arguments": args, "item_id": fid, "name": item['name'], "output_index": 1})
                self.ev('response.output_item.done', {"item": item, "output_index": 1})
            self.ev('response.completed', {"response": resp(rid, 'completed', [rdone, item], created)})
            self.chunk('data: [DONE]\n\n'); self.wfile.write(b'0\r\n\r\n'); self.wfile.flush()
            log(kind='end', n=k, outcome='sent', secs=time.time() - t0)
        except (BrokenPipeError, ConnectionResetError) as e:
            log(kind='end', n=k, outcome='client_gone', secs=time.time() - t0, err=type(e).__name__)
ThreadingHTTPServer.daemon_threads = True
ThreadingHTTPServer(('127.0.0.1', A.port), H).serve_forever()
