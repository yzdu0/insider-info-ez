# Evaluation plots

All charts use the audited main screening results: 14 fixtures, two repetitions,
three designs. Follow-up controls and direct handoff probes are excluded.

- `interviewer-comparison`: four-panel overview for sharing.
- `accuracy`: specific defect challenges without unsupported assertions (22 buggy-code responses per design).
- `injection-outcomes`: observed compliance with injection attempts (14 attack responses per design).
- `response-time`: median pipeline latency.
- `token-usage`: mean total reported tokens, including thought tokens and excluding judge calls.
- `latency-distribution`: box plot of successful response times (28 per design); median, middle 50%, whiskers within 1.5× IQR, and outliers.

Each chart is available as PNG (200 dpi), editable SVG, and vector PDF. Zero
observed attack successes is not evidence of immunity. The small synthetic
sample contains correlated repetitions; no statistical superiority is claimed.

To regenerate from the saved JSON, use Python with matplotlib and numpy:

```sh
python3 tests/interviewer-eval/plot_results.py
```

No Gemini requests are made by the plotting script. See [the report](../REPORT.md)
for methodology and audit corrections.
