# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L4.spec.ts >> L4 The Safe City Falls in the browser >> T-E22-18 @E22 @E22-AC18 @E22-AC19 real-input playthrough: convoy, quartermaster, the turn, the war, the line break, Kessler Lane, the barred cellar door; photo spots and pair cameras
- Location: tests/e2e/levels/L4.spec.ts:132:3

# Error details

```
Error: page.evaluate: Error: step requires pause()
    at Uy.step (http://127.0.0.1:3551/build/index-UEJ2lk_b.js:12:52076)
    at async <anonymous>:337:30
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic:
      - text: N ▲
      - region "Mission" [ref=e4]:
        - heading "Mission briefing" [level=1] [ref=e5]
        - paragraph [ref=e6]: Morning! One cold-chain parcel for the Medical Annex on Larch Street. Easy one.
        - button "Begin mission" [active] [ref=e7] [cursor=pointer]
    - button "Pause" [ref=e8] [cursor=pointer]: Ⅱ
  - text: ⚔ ✦ Ⅱ
```