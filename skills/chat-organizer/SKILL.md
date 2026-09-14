---
name: chat-organizer
description: Analyze a ChatGPT conversation export, discover meaningful project groupings, search and inspect relevant chats, and create or review a safe organization plan. Use when the user wants to organize, classify, move, archive, deduplicate, or understand many ChatGPT conversations or projects. Never perform destructive or browser write actions without explicit user approval.
---

# Chat Organizer

Use Chat Organizer as a reasoning-assisted workspace organizer, not as a blind keyword grouper.

## Core rule

The local CLI exposes conversation data safely. **You provide the semantic reasoning.** Inspect only the conversations needed to justify a grouping, and preserve uncertain items for review.

## Locate the tool

This skill is distributed inside the Chat Organizer repository. Resolve repository-relative commands from the repository root. The agent CLI is:

```bash
node agent/cli.mjs
```

If the repository path is unknown, ask the user for it or locate `agent/cli.mjs` adjacent to this skill package. Do not invent a path.

## Workflow

1. Run `inventory` to understand the size, dates, IDs, titles, and rough scope of the export.
2. Infer candidate projects from repeated product names, goals, workstreams, people, and ongoing learning tracks. Do not treat every repeated keyword as a project.
3. Use `search` to gather candidate chats for a project or topic.
4. Use `read` selectively when titles/excerpts are insufficient or two projects could overlap.
5. Build a proposed plan using the contract in `references/PLAN_CONTRACT.md`.
6. Explain ambiguous groupings and place low-confidence chats in `review` rather than forcing a move.
7. Validate the plan with `validate-plan` and summarize it with `summarize-plan`.
8. Present a concise preview to the user before any executor is allowed to apply changes.

## Commands

```bash
node agent/cli.mjs inventory --export ./conversations.json --json
node agent/cli.mjs search --export ./conversations.json --query "ApplyOS" --limit 20 --json
node agent/cli.mjs read --export ./conversations.json --id <conversation-id> --max-chars 12000 --json
node agent/cli.mjs validate-plan --plan ./chat-organizer-plan.json --json
node agent/cli.mjs summarize-plan --plan ./chat-organizer-plan.json --json
```

## Semantic grouping policy

Group by **user intent and durable workstream**, not vocabulary alone.

Good grouping signals:
- same product/repository/project objective across multiple chats;
- continuation of the same learning program or certification track;
- repeated decisions and artifacts belonging to one long-running effort;
- conversations that refer to renamed or evolved versions of the same project.

Weak signals that require more evidence:
- generic words such as “job”, “Python”, “design”, or “report”;
- one-off questions that merely mention a project;
- similar titles with unrelated goals;
- incidental references to a person, tool, or technology.

When a conversation reasonably belongs to two projects, prefer `review` and state both candidates in the reason/evidence rather than guessing.

## Safety

- This skill is read-only until a user explicitly approves a generated plan.
- Never delete conversations. The current plan contract does not include `delete`.
- Never bypass CAPTCHA, verification, rate limits, anti-bot measures, login challenges, or access controls.
- Browser execution must stop on unexpected UI, authentication challenge, 403/429 responses, or failed verification.
- Archive suggestions should be conservative. Use `archive` only when the conversation is clearly stale/redundant and confidence is high; otherwise use `review`.
- Preserve an audit trail: reasons and evidence should be sufficient for another agent or the user to understand why the action was proposed.

## Progressive disclosure

Read these only when needed:
- `references/PLAN_CONTRACT.md` — plan JSON format and confidence/evidence rules.
- `references/AGENT_INTEGRATION.md` — portability and installation notes for different agents.
- `references/SAFETY.md` — executor boundaries and stop conditions.
