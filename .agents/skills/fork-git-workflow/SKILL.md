---
name: fork-git-workflow
description: Fork-based git workflow guidance for this repository. Use when Codex needs to create or audit branches, split personal work from upstreamable changes, prepare a clean upstream PR from a personal branch, reason about `origin` vs `upstream`, or check whether the current repo state follows the project's fork and branch policy.
---

# Fork Git Workflow

## Overview

Use this skill to keep fork development clean in this repository. Optimize for three goals: keep personal work easy to reuse, keep upstream PRs clean, and detect mixed histories before proposing branch or PR operations.

## Start With A Short Audit

Before suggesting branch moves, rebases, or PR preparation steps, inspect the current git state with short read-only commands:

- `git status --short --branch`
- `git remote -v`
- `git branch -vv`
- `git log --oneline --decorate --graph -10`

Read [references/audit-checklist.md](references/audit-checklist.md) when you need the full decision tree or exact audit checklist.

## Branch Roles

- `upstream/master`
  Treat this as the clean public baseline. Fetch from it often. Do not do day-to-day development directly on a local `master`.
- `personal/main`
  Treat this as the long-lived personal integration branch and the default place for self-use changes.
- `feat/*`
  Treat these as short-lived feature branches. Each branch should carry one theme and can later merge into `personal/main` or be proposed upstream.

## Choose The Correct Base

Pick the base branch from dependency direction, not convenience:

- If the new work is for personal use, branch from `personal/main`.
- If the new work is for upstream review, branch from `upstream/master`.
- If the new work depends on an unmerged feature branch, branch from that `feat/*` branch.

Do not recommend branching from an unrelated dirty feature branch just because it is currently checked out.

## Personal-First Workflow

For new work, prefer this path:

1. Create a `feat/*` branch from `personal/main`.
2. Develop the change for yourself first.
3. Merge or rebase that branch back into `personal/main` when it is meant for self-use.
4. If the user later wants to upstream part of the work, create a fresh `feat/*` branch from `upstream/master` and cherry-pick only the upstreamable commits.

This keeps personal progress separate from upstream PR history without forcing a second maintenance branch.

## Prepare A Clean Upstream Branch

When the user wants to upstream only part of mixed local history:

1. Identify the clean base commit.
2. Create a fresh `feat/*` branch from that base.
3. Cherry-pick only the commits meant for review.
4. Verify the new branch diff against the intended base before proposing a PR.

Prefer this approach over rewriting the user's long-lived personal branch.

## Repository-Specific Guardrails

- Do not create or amend commits unless the user explicitly asks for commit creation. In this repository, if the user only asks for a commit message, provide the message text instead of making the commit.
- Do not use destructive git commands such as `reset --hard` or `checkout --` unless the user explicitly asks and the risk is understood.
- If unexpected working tree changes appear, stop and ask before proceeding.
- When evaluating whether the repo follows the standard, prioritize findings over ceremony: missing `upstream`, working on `master`, mixed personal and feature commits, base confusion, or a dirty tree before branch surgery.

## Report Format

When auditing, report:

1. Current branch and whether it matches its intended role.
2. Remote setup and whether `upstream` is missing.
3. Whether the current branch should be personal, PR, or stacked PR work.
4. Specific fixes, as concrete commands where safe.

Keep the explanation short and operational. If the situation is ambiguous, state the assumption and the consequence of being wrong.
