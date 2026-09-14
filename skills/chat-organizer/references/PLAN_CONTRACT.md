# Plan contract

The approved organization plan is a JSON document. Keep it auditable and conservative.

## Example

```json
{
  "version": 2,
  "generated_at": "2026-09-15T00:00:00Z",
  "generator": {
    "type": "agent",
    "name": "example-agent"
  },
  "projects": [
    {
      "name": "IT-HomeLab",
      "status": "existing",
      "description": "Home lab, Windows Server, AD, Hyper-V, Linux and troubleshooting work."
    }
  ],
  "actions": [
    {
      "id": "conversation-id",
      "title": "Design OU structure",
      "action": "move",
      "project": "IT-HomeLab",
      "confidence": 0.94,
      "reason": "Continuation of the same Home Lab workstream.",
      "evidence": ["DC01", "Active Directory", "Hyper-V"],
      "alternatives": []
    }
  ],
  "safety": {
    "automatic_delete": false,
    "requires_human_approval": true
  }
}
```

## Allowed actions

- `move` — propose moving a chat to a project. `project` is required.
- `keep` — leave the chat where it is.
- `archive` — conservative archive candidate only.
- `review` — ambiguous; human decision required.

`delete` is intentionally unsupported.

## Confidence

Use a value from 0 to 1. Low-confidence moves should become `review` rather than guesses. Archive recommendations should normally be at least 0.8 confidence and have an explicit redundancy/staleness reason.

## Evidence

Evidence should be short factual cues from the conversation, not hidden chain-of-thought. Another human or agent should be able to understand why the proposal was made.
