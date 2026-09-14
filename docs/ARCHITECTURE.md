# Architecture

## Core boundary

The analyzer and executor are separate on purpose.

### Analyzer

Static browser app. Owns:

- Export parsing
- Text extraction
- Classification
- Similarity checks
- Confidence
- User review
- Plan generation

### Executor

Local CLI adapter. Owns:

- Login/session via user-controlled browser
- Reading approved plan files
- Confirming changes
- Applying supported UI actions
- Logging results

The analyzer must never require browser automation to remain useful.

## Plan format

```json
{
  "version": 1,
  "generated_at": "ISO-8601",
  "safety": {
    "destructive_actions_require_confirmation": true,
    "automatic_delete": false
  },
  "summary": {},
  "actions": [
    {
      "id": "conversation-id",
      "title": "Example",
      "action": "move",
      "project": "IT-HomeLab",
      "confidence": 0.91,
      "reason": "Matched home lab keywords."
    }
  ]
}
```

## Future adapters

- Local embeddings for semantic classification
- Optional user-supplied LLM endpoint
- Project presets import/export
- Stable browser adapter when UI behavior is validated
- Audit log and resumable execution
