# Workflow

## Claude Code prompts
All prompts sent to Claude Code are drafted in a separate text copy box first, then pasted in — not typed directly into the session.

## Permissions Boundary (set 12 August 2026)
Claude Code has full autonomy on code changes, local commands, builds, and reading logs — no need to ask permission for these.

Always flag first, no exceptions:
- Anything touching Vercel production settings, environment variables, domain configuration, or anything that costs money
- Triggering an EAS build specifically (real time cost, not just money)
- Any destructive or irreversible database change (dropping a column/table with real data, not additive migrations)
- Any git operation that rewrites history (force-push, or anything that could lose commits) — distinct from normal commit/push
