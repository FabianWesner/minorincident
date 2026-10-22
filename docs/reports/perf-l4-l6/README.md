# L4/L6 acceptance

Goal met on `b47e00336`, matched against `480b44e42`; all changes and receipts are committed.

- L4 WebGPU high turn/tank/break: **54.4/10.8/99.7 → 45.9/11.1/17.1 ms**, zero turn builds.
- L4 WebGPU low turn/tank/break: **59.0/53.9/52.5 → 46.6/34.0/48.3 ms**, zero turn builds.
- L6 heap retention high/low: WebGL **9.32/10.38% → 4.00/5.24%**; WebGPU **10.57/11.83% → 5.36/6.27%**.
- Loading high **4,013.7 → 4,001.2 ms**; low **13,236.9 → 13,924.6 ms** (+687.7 ms, within 1 s).
- Guards, typecheck/lint, remote **2,421 passed** (9 existing skips), smoke **31 passed**; disk cleanup freed **7.9 GiB**.
- [Results](result.json) · [Details and guard mapping](DETAILS.md) · [Raw receipts](evidence/).
