# Review evidence policy

Visual verification media (screenshots, comparisons, recordings) produced
during a build cycle must NOT be committed to the repository:

- attach final review screenshots/recordings directly to the pull request
  conversation (GitHub stores them outside repo history), or
- let CI publish them as workflow artifacts with a retention period.

Binary media under `docs/evidence/` is git-ignored. Markdown notes in this
directory may be tracked when a cycle needs a written evidence index.

Rationale: committed media bloats every future clone permanently; PR
attachments and CI artifacts carry the same review value without entering
Git history. (Introduced while cleaning ~8.6 MB of cycle-5b media out of
the issue #2 branch history.)
