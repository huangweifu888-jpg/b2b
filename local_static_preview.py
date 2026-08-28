import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


DIST_DIR = Path(__file__).parent / "frontend" / "dist"


class SpaHandler(SimpleHTTPRequestHandler):
    api_base_url = "http://127.0.0.1:8000"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self):
        request_path = self.path.split("?", 1)[0]
        if request_path == "/api/config":
            payload = json.dumps({"API_BASE_URL": self.api_base_url}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if request_path.startswith("/api/"):
            self.send_error(502, "Backend API is not proxied by static preview")
            return

        target = DIST_DIR / request_path.lstrip("/")
        if not target.exists() and "." not in Path(self.path).name:
            self.path = "/index.html"
        super().do_GET()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3001)
    parser.add_argument("--api-base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    SpaHandler.api_base_url = args.api_base_url
    server = ThreadingHTTPServer((args.host, args.port), SpaHandler)
    print(f"Frontend static preview: http://{args.host}:{args.port}", flush=True)
    print(f"API base URL: {args.api_base_url}", flush=True)
    server.serve_forever()
