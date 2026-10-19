# AGENTS.md

## Agent skills

### Issue tracker

GitHub issues tracked via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

### Bundled source code for external AI analysis

When bundled source code is requested for external LLM/AI analysis (e.g. Gemini Argon without direct repo or ZIP access), use the plain-text consolidated codebase dump (`cely_projekt_cisty.txt`). Never build, generate, or refer to `znecitelne.html` (the web application artifact) in this context.
