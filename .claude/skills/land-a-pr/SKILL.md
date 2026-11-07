---
name: land-a-pr
description: Lands a branch on Anchored's main through a pull request. Use when a change is ready to push, when opening or merging a PR, or when a branch has fallen behind main.
---

# Land a PR

Several people and agents push to `main` at once, and `main` has no branch protection: GitHub merges a PR the moment you ask, even while CI is still running. Your own `npm run check` on the merged tree is the gate. Run every step in order.

## 1. Merge main into your branch

```bash
git fetch origin
git merge origin/main
```

Use a merge, not a rebase: other agents may have built on your pushed commits. Resolve each conflict by keeping both sides' intent. When another branch moved or renamed a file you import, update your import; never restore the old path. Done when `git status` shows no unmerged paths and the merge is committed.

## 2. Check the merged tree

```bash
npm run check
```

It runs `next typegen` and `tsc`, then Vitest, then `next build`, the same steps as CI. If the type check fails inside `.next/types` after a merge or a branch switch, an old build left those files: delete `.next` and run it again. If `node_modules` predates a dependency change on `main`, run `npm install` first. Done when the command exits 0 on the commit you are about to push. Nothing else counts, including a pass from before the merge.

## 3. Push and open the PR

```bash
git push -u origin HEAD
gh pr create --base main --title "<type(scope): description>" --body-file <file>
```

- **Title:** Conventional Commits, lowercase, present tense, no trailing period, as in `fix(intake): confirm a list the owner already named`.
- **Body:** fill the three sections of `.github/pull_request_template.md`. "What changes" says what an owner or developer will notice and why. "Before deploying" names every new file in `supabase/migrations/` and every new env var, or says "Nothing". "Testing" gives the `npm run check` test count and what you tried by hand.
- No AI attribution in the title, the body or the commits.

## 4. Merge, when you are allowed to

Merge only when the person directing your work has told you to. Otherwise stop after step 3 and hand them the PR link.

```bash
gh pr merge <number> --merge --delete-branch
```

Use a merge commit, so every commit stays in `main`'s history and a branch that keeps going shows only its new commits in its next PR. If GitHub reports a conflict, `main` moved after step 1: go back to step 1. Done when `gh pr view <number> --json state` says `MERGED`.

## 5. Clean up

Remove the worktree you used, and delete the local branch once it is merged:

```bash
git worktree remove <path>
git branch -d <branch>
```
