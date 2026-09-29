#!/usr/bin/env python3
"""A local server-sent events endpoint for bench-client.js.

    bench-server.py <port>

GET /sse?rate=R&secs=S&size=B streams B-byte events, R a second for S seconds, chunked, then ends.
"""
import http.server, socketserver, sys, time, urllib.parse


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def do_GET(self):
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
        rate, secs, size = float(q.get("rate", 20)), float(q.get("secs", 20)), int(q.get("size", 150))
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("transfer-encoding", "chunked")
        self.send_header("connection", "close")
        self.end_headers()
        self.close_connection = True
        event = ('data: {"delta":"' + "x" * max(0, size - 20) + '"}\n\n').encode()
        t0, i = time.time(), 0
        try:
            while time.time() - t0 < secs:
                self.wfile.write(b"%x\r\n%s\r\n" % (len(event), event))
                self.wfile.flush()
                i += 1
                time.sleep(max(0, t0 + i / rate - time.time()))
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass


class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


S(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
