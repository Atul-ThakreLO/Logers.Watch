# Contributions Guide

Thank you for your interest in contributing to Logers.Watch.

## Scope

This repository contains:

- `frontend/` (Next.js app)
- `backend/` (Bun + Elysia API and workers)
- `contracts/` (Foundry Solidity contracts)

Please keep changes focused, small, and testable.

## Development Setup

1. Start infrastructure.

```bash
cd backend
docker compose up -d
```

2. Run backend.

```bash
cd backend
bun install
bun run db:generate
bun run db:migrate
bun run dev
```

3. Run frontend.

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

4. Contract workflow (if touching contracts).

```bash
cd contracts
forge build
forge test
```

## Branching And Commits

- Create a feature branch from the default branch.
- Use clear commit messages describing what changed and why.
- Keep unrelated refactors out of the same PR.

Suggested commit format:

```text
<type>: <short summary>
```

Examples:

- `feat: add creator payout status endpoint`
- `fix: handle missing wallet address in billing sync`
- `docs: improve local setup instructions`

## Pull Request Checklist

Before opening a PR:

- [ ] Code builds in the touched package(s)
- [ ] Relevant tests pass (`forge test`, lint/build where applicable)
- [ ] Environment variables are documented if new ones are added
- [ ] API or contract behavior changes are documented
- [ ] No secrets or private keys are committed

In your PR description include:

- what changed,
- why it changed,
- how it was tested,
- screenshots/video if UI changed.

## Code Quality Expectations

- Prefer clear and explicit logic over clever shortcuts.
- Keep functions small and focused.
- Add comments only when logic is non-obvious.
- Reuse existing patterns in each subproject.

## Security Notes

- Treat all wallet, token, and billing logic as sensitive.
- Do not expose private keys in code, logs, or screenshots.
- For contract changes, include test updates and risk notes.

## Reporting Issues

When reporting a bug, include:

- environment details,
- exact reproduction steps,
- expected vs actual behavior,
- logs or error messages.

## Questions

If requirements are unclear, open an issue or draft PR early so implementation direction can be aligned before large changes.
