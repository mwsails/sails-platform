# SAILS Platform

Self-serve web platform where SAILS clients work through guided sales
exercises and walk away with a customized, compounding sales playbook.

**Full build brief, phased plan, and the two foundational contracts (exercise
schema, context namespace dictionary) live in
[`~/Documents/Claude/Projects/SAILS/`](../Documents/Claude/Projects/SAILS)
(not in this repo — see `CLAUDE.md` for why). Read `CLAUDE.md` before changing
anything.**

## Stack

Next.js (App Router) + TypeScript, Tailwind, Supabase (Postgres + Auth +
Storage), Anthropic API. Content (tracks/modules/exercises/prompts) lives as
versioned YAML/Markdown in `/content`, validated in CI before it can ship.

## Local development

```bash
npm install
npm run content:validate   # validates every file under /content
npm run dev                # http://localhost:3000
```

## Status

Phase 0 (skeleton + contracts) is in progress. See `CLAUDE.md` for what's
done and what's next.
