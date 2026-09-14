# Contributing

Contributions are welcome, especially around export parsing, accessibility, plan validation, and safe executor adapters.

## Ground rules

- Keep conversation processing local by default.
- Never commit real ChatGPT exports, session cookies, credentials, or auth state.
- Do not add anti-bot bypass, CAPTCHA bypass, stealth automation, or undocumented authentication workarounds.
- Keep analysis and execution separated.
- New write actions must require explicit human approval.
- Deletion should remain unsupported unless the project adopts a separately reviewed safety design.

## Development

```bash
npm run check
python -m http.server 8080
```

Then open `http://localhost:8080`.
