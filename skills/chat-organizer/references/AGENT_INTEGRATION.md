# Agent integration

Chat Organizer is designed to be portable across agents.

## Agent Skills-compatible agents

Point the agent at `skills/chat-organizer/SKILL.md` or install/copy that skill folder according to the agent's normal skill-discovery mechanism.

## Terminal-capable agents without Skills

Use the CLI directly. The stable interface is JSON output from:

- `inventory`
- `search`
- `read`
- `validate-plan`
- `summarize-plan`

An agent should inspect only the chats necessary for its decision and then emit a plan conforming to `PLAN_CONTRACT.md`.

## Separation of responsibilities

- Chat Organizer core: local parsing, search, plan validation.
- AI agent: semantic reasoning and project discovery.
- Human: review and approval.
- Browser adapter: optional execution of approved changes only.

Do not couple semantic reasoning to fragile ChatGPT UI selectors.
