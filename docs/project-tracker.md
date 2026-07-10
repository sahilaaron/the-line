# Project Tracker — The Line: Build Control Room

Project URL: https://github.com/users/sahilaaron/projects/2
Repository: https://github.com/sahilaaron/the-line (linked)

## Fields

- **Stage** (main workflow): Inbox → Shaping → Ready → In Progress →
  Review → Done, plus Parked. (The built-in Status field is unused.)
- **Agent**: Fable / Opus / Sonnet / ChatGPT / Human / Unassigned — who
  executes the work.
- **Work Type**: Product / Visual / Engineering / Data / Research /
  Content / Bug / Maintenance.
- **Area**: Temporal Lens, Line View, Temporal Earth, Descent, YoL,
  Database, Research, Media, Thread View, Entity View, Infrastructure,
  Project Management.
- **Priority**: Now / Next / Later / Someday.
- **Size**: Small / Medium / Large / Multi-cycle.
- **Prompt Status**: Raw idea → Shaping → Prompt ready → Running →
  Needs follow-up → Complete.
- **Build Milestone**: Physics prototype, 1969 YoL, Data foundation,
  Research pipeline, Thread prototype, Public alpha, Future.
  (Named "Build Milestone" because GitHub reserves "Milestone".)
- **Risk**: Low / Medium / High.
- **Execution Mode**: Interactive / Autonomous / Either.
- Text: **Blocked By**, **Prompt File**, **Branch**, **Notes**.
- Date: **Target Date**. Number: **Sequence** (ordering within a stage).

## Stage workflow

Inbox (captured) → Shaping (problem/outcome being defined) → Ready
(prompt ready, scheduled) → In Progress (an agent is running it) →
Review (evidence posted, awaiting Sahil) → Done. Parked holds work
deliberately set aside; parked issues keep their fields.

## How ChatGPT-shaped ideas become issues

Ideas shaped in ChatGPT are pasted into the **Shaped feature** form (or
**Raw idea** if unshaped). Set Agent to the recommended executor,
Prompt Status to Shaping/Prompt ready, and Stage accordingly. When a
full build prompt exists, either upgrade the issue with a **Build job**
comment or file a Build job issue and reference the original.

## How Claude should update issues

When Claude picks up an issue: set Stage → In Progress and Prompt
Status → Running, fill Branch/Prompt File if applicable. On completion:
comment with what was built, tests run, deviations and known defects
(same shape as the PR template), set Prompt Status → Needs follow-up or
Complete, and move Stage → Review. Claude never closes issues and never
moves them to Done.

## Ready → In Progress → Review → Done

Ready means the prompt and acceptance criteria are final. An agent (or
Sahil) moves it to In Progress when execution starts. The executor moves
it to Review with evidence attached. **Only Sahil moves an issue from
Review to Done.**

## Branch workflow

`Ready → issue branch → In Progress → pull request → Review → Sahil
approval → merge → Done`

Branch naming: `issue-<number>/<short-description>` (kebab-case), created
from the latest remote `main`. All substantive work happens on issue
branches and arrives in `main` only through a pull request linked to its
issue. **Only Sahil merges into `main` and moves issues from `Review` to
`Done`.** Agents stop at `Review`. See `CLAUDE.md` for the full git rules
and the session startup checklist.

## Board views (manual setup required)

GitHub's public API/CLI cannot create or modify Project views (verified:
no view mutations in the GraphQL schema), so views are configured in the
UI. Target setup — current tabs are "Stage View" (table) and "Agent View"
(board, still grouped by built-in Status, which is why everything shows
under Todo):

1. **Build Board** — rename the board tab (▼ on the tab → Rename) to
   `Build Board`; view options (▼) → *Column field* → **Stage**. Do not
   delete the built-in Status field; it is simply unused.
2. **Ready for Agents** — New view → Board; filter `stage:Ready`;
   column field **Agent**.
3. **Active Work** — New view → Board; filter
   `stage:"In Progress",Review`; column field **Stage**.
4. **Ideas and Shaping** — New view → Board; filter
   `stage:Inbox,Shaping`; column field **Stage**.
5. **Completed Cycles** — New view → Board; filter `stage:Done`;
   column field **Build Milestone**.
6. **Autonomous Jobs** — New view → Board; filter
   `execution-mode:Autonomous stage:Ready,"In Progress"`; column field
   **Agent**.

Click *Save changes* on each view tab after configuring it.
