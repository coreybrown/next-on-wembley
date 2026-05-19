# Contributing

## Keep the spec docs current

Any change that shifts product behaviour or visual/interaction design **must** also update the relevant spec doc in the same commit. Treat the docs the same way as the unit-test suite: tests prove the code does what it claims; the spec docs prove we still agree on what the product is supposed to do. If either drifts, the other becomes unreliable.

In-scope docs (live at the project root, joined automatically when new ones are added):

| Doc | Owns |
|---|---|
| `PROD_REQS.md` | Product behaviour, rules, exclusions, error states, success metrics. |
| `DESIGN_SPEC.md` | Tokens, component inventory, organism specs, state tables, motion. |

Before committing, glance at `ls *.md` at the project root. If a change touches what one of those docs claims, edit it in the same commit. Tuning constants (e.g. cap=16, retry counts, log line shape) stay in code; *behavioural contracts* — "when X happens, the system does Y" — belong in the spec.

## Tests

Unit tests are required for pure logic, server actions, API routes, and interactive components. Pure presentation can be skipped; layouts get a smoke render. Co-locate under `__tests__/` next to the source. Run with `npm test`.
