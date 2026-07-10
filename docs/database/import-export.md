# Import / Export (Cycle 3)

Versioned JSON format (`formatVersion` field, currently `1`, see
`src/db/import-export/types.ts`). All import is transactional — a single
`db.transaction()` wraps every insert, so a bad record rolls back the whole
import (no partial writes).

## Scripts

```bash
npm run db:export -- [outFile] [--yol <yolId>]   # full DB, or one YoL closure
npm run db:import -- <file> [--dry-run]          # transactional import
```

(Note: with npm you need `--` before script args, e.g.
`npm run db:export -- docs/generated/db-export.json`.)

- `db:export` with no args writes `docs/generated/db-export.json` (full DB).
- `db:export -- --yol <yolId>` writes just that YoL composition plus the
  transitive closure of what it references: its period, its theme/featured
  entities, any relationships/claims/sources touching those entities.
- `db:import -- <file> --dry-run` runs the exact same insert sequence inside
  a transaction and always rolls it back — validates real FK/unique
  constraints without writing anything.
- Every insert uses `onConflictDoNothing()`, so re-importing the same file
  is safe (existing rows are skipped, counted separately from created).
- Import prints a human-readable summary: counts created/skipped per table,
  plus error messages on failure.

## Format notes

- Dates (`createdAt`/`updatedAt`/`exportedAt`) serialize to ISO strings in
  JSON; `db:import`'s CLI revives them back to `Date` objects via a
  `JSON.parse` reviver before handing the payload to `importFixture()`. If
  you call `importFixture()` directly with a payload you built yourself
  (not read from a file `db:export` wrote), make sure those three fields
  are real `Date` objects, not strings.
- Large tables are inserted in chunks of 500 rows per `INSERT` (see
  `INSERT_CHUNK_SIZE` in `src/db/import-export/import.ts`) — needed for the
  synthetic dataset scale (10k+ periods, 20k+ relationships); still fully
  inside one transaction.
- `claims.subjectId` and `media_associations.subjectId` are polymorphic
  string references, exported/imported as plain rows — the audit script is
  what verifies they still resolve after an import, not a DB constraint.

## Round-trip

`exportDatabase()` → `importFixture()` into a fresh, freshly-migrated DB is
covered by `src/db/import-export/import-export.test.ts` (row counts match)
and was additionally verified manually end-to-end against the full
prototype + synthetic dataset (10,005 periods / 5,018 entities / 20,000
relationships / etc. — see the cycle 3 section of
`docs/implementation-notes.md` for the exact numbers and the sandbox note
about where the dev-persistent data dir has to live).
