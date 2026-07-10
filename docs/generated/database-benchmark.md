# Database Benchmark Report

Generated: 2026-07-09T22:30:48.872Z

Measured with `performance.now()` inside a single Node process against fresh in-memory PGlite instances. Numbers are wall-clock and machine/sandbox-dependent — treat them as relative signal, not an absolute SLA. Synthetic targets: {"entities":5000,"periods":10000,"relationships":20000,"claims":2000,"sources":1000,"yolCompositions":100}.

## Prototype dataset (5 anchors)

| Operation | ms |
|---|---|
| prototype: db init | 0.00 |
| prototype: migration | 2980.93 |
| prototype: seed insertion | 147.43 |
| prototype: entity lookup (by slug + by id) | 2.24 |
| prototype: period lookup (exact year) | 3.88 |
| prototype: direct relationship query | 1.68 |
| prototype: depth-3 ancestry traversal | 1.74 |
| prototype: depth-3 consequence traversal | 1.36 |
| prototype: shortest-path query | 3.80 |
| prototype: YoL composition load | 2.79 |
| prototype: integrity audit | 15.43 |

## Synthetic stress dataset

| Operation | ms |
|---|---|
| synthetic: db init | 0.00 |
| synthetic: migration | 1353.35 |
| synthetic: seed insertion | 9434.15 |
| synthetic: entity lookup (by slug + by id) | 2.02 |
| synthetic: period lookup (exact year) | 54.29 |
| synthetic: direct relationship query | 5.57 |
| synthetic: depth-3 ancestry traversal | 7.63 |
| synthetic: depth-3 consequence traversal | 6.25 |
| synthetic: shortest-path query | 791.46 |
| synthetic: YoL composition load | 56.17 |
| synthetic: integrity audit | 1436.86 |

## Notes

- "db init" is reported as 0ms because PGlite construction is lazy — the first real cost shows up in "migration".
- Practical warning threshold (not a hard build gate): a single hop/traversal query taking >500ms on the synthetic dataset in this sandbox would suggest a missing index or an accidental full-table scan — investigate before scaling further.
- This sandbox is not representative of production hardware; re-run on target hardware before trusting absolute numbers.
