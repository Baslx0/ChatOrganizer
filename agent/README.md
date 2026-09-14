# Agent integration

Chat Organizer exposes a small read-only CLI so an AI agent can inspect a ChatGPT export without loading the whole file into context.

## Why this exists

The web UI gives the human a transparent baseline. Agent mode lets Codex, Claude Code, or another terminal-capable agent reason semantically about long-running projects, renamed workstreams, overlapping topics, and ambiguous chats.

## Commands

```bash
node agent/cli.mjs inventory --export ./conversations.json --json
node agent/cli.mjs search --export ./conversations.json --query "home lab" --limit 20 --json
node agent/cli.mjs read --export ./conversations.json --id <conversation-id> --json
node agent/cli.mjs validate-plan --plan ./chat-organizer-plan.json --json
node agent/cli.mjs summarize-plan --plan ./chat-organizer-plan.json --json
```

The CLI never logs in to ChatGPT and never performs browser writes.

For agents that support Agent Skills, start with `skills/chat-organizer/SKILL.md`.
