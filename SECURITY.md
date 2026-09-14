# Security

Chat exports may contain highly sensitive personal or work information.

## Data defaults

- Keep processing local.
- Do not commit exports or generated plans containing private titles/content.
- Do not store ChatGPT credentials.
- Do not disable browser security controls.
- Avoid undocumented private APIs and copied session tokens.
- When an external agent reads conversations, that agent/provider's own privacy settings apply to the content the user permits it to access.

## Agent boundary

`agent/cli.mjs` is read-only with respect to ChatGPT. It supports bounded inventory, search, per-conversation reads, and plan validation/summarization.

The bundled Agent Skill instructs agents to retrieve selectively, keep evidence concise, and use `review` for ambiguous classifications instead of forcing actions.

## Browser executor boundary

Any future browser executor must keep the browser visible, use manual login, execute sequentially, and require approval before writes.

It must immediately stop on CAPTCHA, verification challenges, 403/429 responses, session invalidation, or unexpected UI. It must not attempt to bypass or disguise automation to defeat service protections.

Automatic deletion is not supported.
