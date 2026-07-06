# Fork Workflow Audit Checklist

Use this file when the request is about branch hygiene, PR preparation, or "did we follow the workflow?"

## Fast Commands

Run these first:

```bash
git status --short --branch
git remote -v
git branch -vv
git log --oneline --decorate --graph -10
```

Add these when needed:

```bash
git log --oneline upstream/master..HEAD
git log --oneline HEAD..upstream/master
git diff --stat upstream/master...HEAD
```

## Expected State

The preferred repository layout is:

- `upstream/master`: canonical clean base
- `personal/main`: long-lived personal integration branch
- `feat/*`: one work theme per branch

## Findings To Check

### Remotes

- `origin` should point to the user's fork.
- `upstream` should point to the canonical upstream repository.
- If `upstream` is missing, call that out first because every other rule becomes harder to follow.

### Active Branch

- Working directly on `master` is a smell unless the user is only inspecting history.
- `feat/*` should be a work branch, not the long-lived personal integration branch.
- `personal/main` should be the default base for self-use work.

### Branch Base

- If work is for self-use, the branch should base on `personal/main`.
- If work is meant for upstream review, the branch should base on `upstream/master`.
- If work depends on an open feature branch, the branch should base on that branch.
- If the branch carries mixed personal and upstreamable commits, recommend creating a fresh branch from the correct base and cherry-picking only the relevant commits.

### Lifecycle

- A PR branch stays alive until its PR is merged or closed.
- "Coding finished" does not mean the feature branch is dead.
- A stacked child branch should explicitly name its parent PR branch when discussed.

## Recommended Fixes

### Missing upstream

```bash
git remote add upstream <canonical-repo-url>
git fetch upstream
```

### Create personal work branch

```bash
git switch -c feat/<topic> personal/main
```

### Create upstream review branch

```bash
git fetch upstream
git switch -c feat/<topic> upstream/master
```

### Create dependent branch

```bash
git switch feat/<parent>
git switch -c feat/<child>
```

### Split mixed history

```bash
git switch -c feat/<topic> <clean-base-commit>
git cherry-pick <wanted-commit> [<wanted-commit> ...]
```

### Continue personal integration

```bash
git switch personal/main
git merge <branch>
```

Prefer `rebase` over `merge` only when the user wants a clean linear history and the branch is safe to rewrite.
