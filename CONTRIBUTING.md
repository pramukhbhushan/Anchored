# Contributing to Anchored

Anchored is a finished hackathon project; issues and PRs are welcome, with no promise of a quick review.

Everyone who takes part follows the [code of conduct](CODE_OF_CONDUCT.md). To report a security problem, follow [SECURITY.md](SECURITY.md) instead of opening an issue.

## Report a bug or ask for a feature

Open an issue from one of the templates. For a bug, say what you did, what you expected and what happened, and whether you ran with accounts and AI on or off.

## Run it

The [README](README.md) covers setup. A fresh clone needs Node.js 26, the version in `.nvmrc`, and no keys:

```bash
npm ci
npm run dev
```

With no `.env.local`, accounts and AI are off, data lives in memory, and the rules draft every profile and card.

## Make a change

1. Read [AGENTS.md](AGENTS.md) first, whether you or a coding agent writes the code. It holds the rules that protect owners' customers, the UI rules and the [conventions](AGENTS.md#conventions). [docs/architecture.md](docs/architecture.md) says which layer may import which, and where to add a workflow, connector, route or migration.
2. Branch from `main`. Name the branch `feat/`, `fix/`, `docs/`, `refactor/` or `ci/` plus a short slug, such as `fix/quiet-hours-dst`.
3. Put tests beside the code: `<name>.test.ts` for logic and `<name>.test.tsx` for components.
4. Write commit messages in [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) form, such as `fix(executor): hold texts until 8 a.m. in the owner's time zone`.
5. Run `npm run check`. It runs the type check, the tests and the build, the same steps as CI.
6. Open a pull request and fill in the [template](.github/pull_request_template.md). List any owner-facing text you changed, and any migration or environment variable a deploy needs.

[The land-a-pr skill](.claude/skills/land-a-pr/SKILL.md) has the full steps for landing a branch, including merging `main` again before the final check.

## Owner-facing text

Anchored's users run small businesses and are not engineers. Write every string they see in plain words: say what happened, then what to do next. The refusals in `checkSend` in `lib/domain/executor.ts` set the tone.
