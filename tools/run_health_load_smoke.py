"""Run bounded, credential-free GET health probes and report latency percentiles."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import statistics
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen


def probe(endpoint: str, timeout: float) -> tuple[bool, float]:
    started = time.perf_counter()
    try:
        with urlopen(Request(endpoint, headers={"Accept": "application/json"}), timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status == 200 and payload.get("status") == "healthy", (time.perf_counter() - started) * 1000
    except Exception:
        return False, (time.perf_counter() - started) * 1000


def measure(endpoint: str, requests: int, concurrency: int, timeout: float) -> dict[str, object]:
    if not endpoint.startswith(("http://", "https://")) or "?" in endpoint or "@" in endpoint:
        raise ValueError("endpoint must be a credential-free HTTP(S) URL without a query")
    if not 1 <= requests <= 500 or not 1 <= concurrency <= 50:
        raise ValueError("requests must be 1..500 and concurrency must be 1..50")
    results: list[tuple[bool, float]] = []
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(probe, endpoint, timeout) for _ in range(requests)]
        for future in as_completed(futures):
            results.append(future.result())
    latencies = sorted(item[1] for item in results)
    index = max(0, min(len(latencies) - 1, int(len(latencies) * 0.95 + 0.999999) - 1))
    failures = sum(1 for passed, _ in results if not passed)
    return {"requests": requests, "concurrency": concurrency, "passed": requests - failures, "failed": failures, "p50_ms": round(statistics.median(latencies), 2), "p95_ms": round(latencies[index], 2), "error_rate_percent": round(failures * 100 / requests, 2)}


class HealthyHandler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"healthy"}')

    def log_message(self, format, *args):  # noqa: A002
        return


def self_test() -> int:
    server = ThreadingHTTPServer(("127.0.0.1", 0), HealthyHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        result = measure(f"http://127.0.0.1:{server.server_port}/api/v1/operations/health", 20, 5, 2)
    finally:
        server.shutdown()
        server.server_close()
    assert result["failed"] == 0 and result["p95_ms"] >= 0
    print("Health load smoke self-test: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--timeout", type=float, default=5)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.endpoint:
        parser.error("--endpoint is required unless --self-test is used")
    print(json.dumps(measure(args.endpoint, args.requests, args.concurrency, args.timeout)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
