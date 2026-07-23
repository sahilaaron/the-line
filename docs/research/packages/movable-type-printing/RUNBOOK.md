# Runbook — Movable-type printing research batch

First real batch through the research pipeline (Cycle: run the research
pipeline). Everything below was proven end-to-end in a throwaway sandbox
DB on 2026-07-23; the human decision and promotion in YOUR dev DB remain
Sahil's alone, via the CRM.

## Files

- `package.json` — the research package envelope (passes the Zod contract
  as-is; derived from `docs/research/movable-type-printing-1400-1500.md`).
- `qa.json` — the QA contract. Holds 4 items as two pairs:
  - `rel-asia` + claim `c-transmission` — Asia→Europe transmission is
    contested (Gies vs McDermott); must not promote as fact.
  - `rel-coster` + claim `c-coster` — the Coster invention claim is
    regarded as legend.
  NOTE: an accepted claim may not reference a held relationship — the
  kernel aborts promotion. That is why the claim holds accompany the
  relationship holds.

## Replay on your machine (from the repo root)

1. Capture a manual job in the CRM (`/crm/queue`) titled
   `Movable-type printing` — manual jobs outrank frontier/discovery, so
   this works even with a non-empty queue. (Alternative on an empty
   queue: add `--seeds "Movable-type printing"` to the claim.)
2. `npm run research:agent -- create-run --limit 3 --operator Sahil`
   (skip if an active run exists — check `npm run research:agent -- status`).
3. `npm run research:agent -- claim --run <runId> --worker cowork-sahil`
   → note `jobId` and `leaseToken`. Confirm the claimed title is
   `Movable-type printing`; if a different job comes back first, release
   it (`release --job <id> --worker cowork-sahil --lease-token <token>`)
   or research it separately.
4. `npm run research:agent -- submit --job <jobId> --worker cowork-sahil
   --lease-token <token> --file docs/research/packages/movable-type-printing/package.json`
5. `npm run research:agent -- qa --package <pkgId>
   --file docs/research/packages/movable-type-printing/qa.json`
   → expect `recommendation: hold` with exactly 4 heldItems.
6. Review in `/crm/packages/<pkgId>`. Expected on approve-with-holds
   (QA holds carry; no extra reviewer holds needed): 13 entities,
   9 periods, 9 time associations, 13 relationships, 10 claims,
   12 sources, 1 placeholder media, 16 frontier jobs; 4 held items stay
   in staging with their evidence.

## Review decision points (Sahil)

- **Laurens Coster** promotes as an entity whose only relationship is
  held → `db:audit` will warn `unreachable_entities` (expected). If you
  would rather keep him out of the canonical graph entirely until the
  legend has a proper historiographic treatment, additionally hold the
  entity item `coster` at decision time.
- Disputed figures (Bible copies, output volumes, town counts) are
  asserted as honest ranges with `corroborated` (not `verified`) status.
- `t-invented` chronology is a deliberate low-confidence 1436–1450 range;
  the date dispute lives in question `q-date`.

## Historical integrity notes

- Every `verified` claim cites checkable sources; quotations are
  transcribed from the cited pages and flagged for re-verification before
  any public use (see the research file §7 and the `q-britannica` question).
- Nothing here is published: promotion writes PRIVATE canonical rows only
  (isPlaceholder, draft/in_review); `yol_*` is untouched.
