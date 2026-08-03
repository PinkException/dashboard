# Lightweight Decisions

> Status: Draft (wizard-generated)

Small shipped decisions that fall outside spec slices but carry durable rationale:
brand/icon swaps, cosmetic CSS polish, UI string or translation choices, scoped
visual decisions, and "future sessions should/should not override this" notes.

## Routing rubric — where does this decision land?

Triage each settled decision to exactly **one** home:

| Route | Criterion |
|---|---|
| **ADR** | A load-bearing design choice with rejected alternatives — one a future agent would need to know about to avoid undoing it — warrants an ADR even when it changes no module boundary or public contract. Also: any change to a module boundary, public contract, or cross-cutting policy. |
| **Lightweight record (here)** | Settled, local, bounded (one screen / component / string / asset), with no real rejected alternatives — and a future agent would need to know it to avoid undoing it. |
| **`refinement-todo.md`** | Still *open* — has a resolution trigger; not shipped yet. |
| **Drop (write nothing)** | Ephemeral / trivial / already obvious from the code or a commit message. |

The **ADR** row's trigger sentence is single-sourced — the *same* wording appears
in both reconcile checklists and the memory-sync session-end prompt, so the "when
is an ADR required?" policy can't drift across surfaces.

Record a lightweight entry with the helper (idempotent append):

```bash
python3 "${CLAUDE_PROJECT_DIR}/.claude/skills/jig-memory-sync/decisions.py" add-lightweight \
  --title "<short title>" --decision "<what>" --context "<why>" --scope "<where>"
```

## Template

```markdown
### [Date] — [Short title]

**Decision:** _what was decided_

**Context:** _why — constraint, user feedback, design call_

**Scope:** _which screen / component / string / asset — not product-wide_

**Commit:** _optional — git SHA or PR; may be added retroactively_
```

This matches what `decisions.py add-lightweight` emits (one blank line between
fields), so the documented shape and the helper output agree.

---

## Entries

### 2026-07-22 — Jig scaffolding realigned to 2.8.0; scaffold_mode is plugin-only

**Decision:** scaffold.json regenerated with jig's own adoption_manifest (2.5.0 → 2.8.0, tier-0 + tier-1, has_tests true, scaffold_mode plugin-only, project_name dashboard). ADR-0001/0002/0003 gained status frontmatter + a ## Status section so the → DONE gate can read them. The pre-rename name was swept from live prose inline and annotated with dated ## Amendments on closed specs 001/004, per jig ADR-0010 (records vs live operational prose). ADR-0003's body stays as written — it says so itself.

**Context:** Audit found the install manifest three versions stale and factually wrong (claimed no tests, claimed in-repo machinery this repo does not carry), and three ADRs in a status format jig's gate cannot parse — a latent refusal on the next ADR-dependent slice → DONE. Owner asked for all three fixed in one pass. project_name and is_team were overridden by hand: the builder derives the name from the folder (a worktree here) and counts Claude's co-author email as a second contributor.

**Scope:** scaffold.json, docs/decisions/adr-0001..0003, live docs prose, closed specs 001/004, .jig/no-people-md

### 2026-08-01 — snapshot source: "dashboard" provenance value + plugin 0.3.0

**Decision:** The narrative /dashboard:snapshot skill (005-03) tags its entries source: "dashboard" via a new snapshot.mjs --source flag, distinct from a human 'manual' headline and the deterministic 'auto' line. validateSnapshot does not constrain source, so this is a documented convention (architecture.md), not a validated enum. Plugin version bumped 0.2.1 -> 0.3.0 (plugin.json + package.json) so the new skill reaches an installed plugin.

**Context:** ADR-0004 OQ1 resolved that the dashboard writes narrative via its own skill; the future evolution view (OQ2) may want to tell the three producers apart. A new skill does not propagate to an installed plugin without a version bump.

**Scope:** scripts/snapshot.mjs, skills/snapshot/SKILL.md, docs/architecture.md, .claude-plugin/plugin.json, package.json

### 2026-08-03 — Recurring-snapshot cadence: on-change deterministic

**Decision:** The rebuilt compass-snapshots routine writes deterministic `snapshot.mjs --all --auto --if-changed` entries only (no unattended narrative). On-change cadence: a project is skipped unless its progress signature (specs.done/total + active spec) differs from its last stored same-source entry; open-bug churn is excluded. The card reader prefers the latest narrative (non-auto) entry so the daily auto series never buries 005-03's prose.

**Context:** ADR-0004 OQ2 + owner decisions 2026-08-01 (deterministic-only, on-change) and 2026-08-03 (card prefers prose). Two frame-critique findings folded in: full-headline comparison would sample bug-count noise; source-blind card selection would bury prose.

**Scope:** scripts/snapshot.mjs (--if-changed), src/lib.mjs (parseCompassHistory.latestNarrative), src/scan.mjs (scanCompass), per-user ~/.claude/scheduled-tasks/compass-snapshots/
