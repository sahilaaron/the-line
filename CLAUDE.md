# CLAUDE.md — The Line

Operating instructions for agent sessions in this repository. Project
character, build conventions and documentation rules live in the project
instructions and `docs/`; this file governs repository workflow.

## Git and branch rules

Substantive work (features, fixes beyond typos, visual cycles, data work,
refactors) MUST happen on a dedicated issue branch — never directly on
`main`.

- Create the branch from the latest remote `main`
  (`git fetch origin && git switch -c <branch> origin/main`).
- Branch naming: `issue-<number>/<short-kebab-description>`
  (e.g. `issue-3/read-only-data-studio`).
- Verify the active branch (`git branch --show-current`) BEFORE editing
  any file.
- Commit and push to the issue branch only.
- Open a pull request linked to the relevant issue (`Closes #<number>`),
  using the repository PR template.
- When the work is complete and verified, move the issue to `Review`
  on the Build Control Room project.
- Agents never merge into `main`.
- Agents never move issues to `Done`.
- Sahil alone approves pull requests, merges into `main`, and moves work
  from `Review` to `Done`.

Direct work on `main` is limited to:

- trivial documentation fixes;
- typo corrections;
- emergency repository repair;
- work explicitly authorised by Sahil.

If a substantive session finds itself on `main`, STOP before editing and
create the correct issue branch first. If no issue exists for a
substantial task, create one (or ask Sahil for one) before implementing.

## Session startup checklist

Before making changes, verify and record:

1. Current branch (`git branch --show-current`) — is it the right issue
   branch?
2. The associated issue number and that it matches the work requested.
3. The issue's Stage on the project board (should be `Ready` or
   `In Progress`; set it to `In Progress` when starting).
4. Working tree status (`git status`) — start clean or account for
   leftover changes.
5. Latest remote `main` (`git fetch origin`) — branch from or rebase onto
   it as appropriate.

## Related documents

- `docs/project-tracker.md` — project board, fields, Stage workflow,
  branch workflow.
- `GOAL.md` — the current build cycle's mission.
- `docs/implementation-notes.md` — decisions, findings, defects.
