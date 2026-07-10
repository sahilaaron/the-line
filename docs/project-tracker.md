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
