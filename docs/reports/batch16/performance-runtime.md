# Benchmark runtime

The unchanged benchmark uses an isolated [Node.js 22.20.0 binary](https://nodejs.org/en/blog/release/v22.20.0), verified against the official archive checksum in `performance-node-runtime.json`. Both main and batch16 use the same binary and native Chrome version. Repository dependencies and benchmark thresholds are unchanged.

The Node 26 socket failure and a later rejected overlapping-browser sample are preserved in `horde-node26-interrupted/` and `horde-overlapping-browser/`; their partial receipts are excluded from the final comparison.
