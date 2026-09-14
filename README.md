# Chat Organizer

A privacy-first local workspace organizer for ChatGPT conversations, with both a human web UI and an **agent-compatible interface**.

The project is designed around one principle: **agents should reason about the meaning of your chats, not blindly bucket them by keywords.**

## What it does

- Imports a ChatGPT `conversations.json` export locally.
- Provides a static web UI for manual review and simple deterministic classification.
- Ships an Agent Skills-compatible `SKILL.md` for reasoning-assisted organization.
- Gives agents a read-only CLI to inventory, search, and selectively read conversations without loading the entire history into context.
- Supports agent-discovered project groupings, evidence, confidence, alternatives, and review states.
- Validates and summarizes organization plans before execution.
- Keeps browser execution separate from analysis and approval.
- Never includes automatic delete in the supported action contract.

## Privacy

The web app processes exports in your browser. The agent CLI reads local files. Chat Organizer itself does not upload conversation content to a server.

When you use an external AI agent, that agent's own privacy/data settings still apply to whatever content you explicitly allow it to read.

## Run the web UI

No build step is required.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

On Windows, `py -m http.server 8080` also works.

## Agent mode

The repository includes:

```text
skills/chat-organizer/SKILL.md
agent/cli.mjs
```

The skill follows the portable Agent Skills pattern: a `SKILL.md` entrypoint with supporting references. Codex and Claude Code both support skill folders, and agents that do not can still use the CLI/JSON contract directly.

Start with:

```bash
node agent/cli.mjs --help
node agent/cli.mjs inventory --export ./conversations.json --json
node agent/cli.mjs search --export ./conversations.json --query "home lab" --limit 20 --json
node agent/cli.mjs read --export ./conversations.json --id <id> --json
```

The intended reasoning workflow is:

```text
ChatGPT export
      ↓
Local inventory/search/read tools
      ↓
AI agent semantic reasoning
      ↓
Project discovery + evidence-backed plan
      ↓
Plan validation
      ↓
Human review / approval
      ↓
Optional safe browser executor
```

This is intentionally different from the web UI's MVP keyword rules. The UI gives a transparent baseline; **agent mode is expected to use semantic context and user intent**.

See [`skills/chat-organizer/SKILL.md`](skills/chat-organizer/SKILL.md) and [`agent/README.md`](agent/README.md).

## Plan contract

Plans support `move`, `keep`, `archive`, and `review`. There is no `delete` action.

Agent-generated v2 plans may include:

- project descriptions and whether they are existing/proposed;
- per-chat confidence;
- short reasons and evidence;
- alternative candidate projects for ambiguous chats;
- generator metadata and safety flags.

The current executor remains compatible because core fields (`id`, `title`, `action`, `project`, `confidence`, `reason`) are preserved.

## Safety model

Analysis and execution are separate on purpose.

A future browser executor must:

1. use a visible, user-controlled login/session;
2. execute sequentially and verify each result;
3. support pause/checkpoints and small user-approved batches;
4. stop on CAPTCHA, MFA/verification, 403/429, logout, or unexpected UI;
5. never attempt to bypass anti-bot or access controls;
6. require explicit approval before any write action;
7. keep delete unsupported.

See [`skills/chat-organizer/references/SAFETY.md`](skills/chat-organizer/references/SAFETY.md).

## Project status

Experimental MVP. ChatGPT's UI can change, so browser automation is treated as a replaceable adapter rather than the core of the product.

## License

MIT
