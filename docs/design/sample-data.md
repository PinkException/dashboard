# Dashboard — working sample data (for design)

> **This is the project's canonical working sample dataset for design work.**
> Hand it to Claude Design (CD) so mockups are built against realistic content.
> **All content below is invented placeholder data** — eight fictional projects,
> made up purely to design against. Nothing here is a real project.

## What the dashboard is

One local page that shows **every project the owner is running**, so they can see
at a glance *which projects need them right now, and for what* — read entirely
from files already on disk (no database, no login). **One card per project**,
many cards on one page. The design has to stay scannable when a project has 3
specs **and** when it has 60.

## The fields every project card carries

- **Header** — project name/label + a one-line description + a status chip:
  `active`, or `all specs done`.
- **Needs you** *(the headline triage signal)* — what genuinely needs *this
  person's* action: a decision to make, work awaiting their review, something to
  merge — a small count plus a word or two on what it is. **Usually empty** —
  most projects, most days, need nothing — so "nothing needs you" is a
  first-class, calm state to design well.
- **Progress** — a percentage bar (specs done ÷ total specs).
- **Counts line** — specs done / in-progress / draft / total · open bugs ·
  deferred decisions · inbox items.
- **Specs** — a per-spec list: id, status (`DONE` / `IN_PROGRESS` / `DRAFT` /
  `DEFERRED` / `ABANDONED`), and slices-done / slices-total. **Can be long**
  (some projects have 60+ specs) — today it's collapsed by default.
- **Workstreams** — release plans and runbooks (a title + a kind: `release` or
  `runbook · N phases`), plus sometimes "discovered, not pinned" items.
- **Sessions** — the working sessions for that project: a **title**, a git
  **branch**, a **worktree** name, whether it's **running now** (● badge), and
  **last activity** ("just now" / "2h ago" / "3d ago"). Shown active-first,
  capped, with a summary header **"N active · M older (+K not shown)"** and a
  **"show older"** toggle.
- **Worktree warnings** — docs that exist only in an un-merged worktree.
- **"What's next" narrative** — a headline, an optional **Next:** line, an
  optional **Blocked:** line, and an age ("40m ago"). Can be marked stale.

The eight samples below deliberately span the range: empty states, overflow,
long titles, a finished project, a blocked/troubled one, a big review queue, and
the calm "nothing needs you" case. The cards are all the same size regardless of
how much each project has going on.

---

## 1. Trailhead — hiking route planner
*Big and busy — many specs, lots of sessions, overflow.*

- **Chip:** `active`
- **Needs you:** **1 decision parked on you** (a routing-engine choice)
- **Progress:** **62%**
- **Counts:** 18 done · 3 in progress · 7 draft · **28 specs** · 2 open bugs · 9 deferred decisions · 14 inbox

**Specs** *(28 total — a representative slice)*
| id | status | slices |
|---|---|---|
| 001-core-map | DONE | 4/4 |
| 002-route-drawing | DONE | 3/3 |
| 003-waypoints | DONE | 2/2 |
| 014-elevation-profile | IN_PROGRESS | 2/4 |
| 019-offline-tiles | IN_PROGRESS | 1/3 |
| 021-gpx-import | IN_PROGRESS | 0/2 |
| 022-trail-conditions | DRAFT | 0/2 |
| 025-social-share | DEFERRED | — |
| 027-3d-flyover | DRAFT | 0/5 |
| … | *(19 more)* | |

**Workstreams**
- Release Plan: **Public Beta (v0.9)** — `release`
- Release Plan: **iOS App Store submission** — `release`
- **Onboarding Runbook** — `runbook · 8 phases`
- *discovered, not pinned:* Weather-overlay spike (2/6) · Import-format survey (0/4)

**Sessions** — header: **6 active · 14 older (+51 not shown)**  *(71 total, 20 emitted)*
| title | branch | worktree | running | last activity |
|---|---|---|---|---|
| Elevation profile smoothing | claude/014-elevation-smoothing | trailhead-elev-a1b2 | ● | just now |
| Offline tile cache eviction | claude/019-offline-tiles | trailhead-offline-c3d4 | ● | 12m ago |
| GPX import edge cases | claude/021-gpx-import | trailhead-gpx-e5f6 | ● | 38m ago |
| Fix route snapping jitter | claude/bug-route-snap | main | ● | 1h ago |
| Beta release checklist | claude/release-beta-prep | trailhead-beta-7h8i | ● | 2h ago |
| Trail-conditions API research | claude/022-conditions | trailhead-cond-9j0k | ● | 4h ago |
| Waypoint drag polish | claude/003-waypoint-polish | trailhead-way-l1m2 | | 2d ago |
| *(13 more older, then +51 not shown)* | | | | |

**Worktree warning:** ⚠ 3 docs exist only in a worktree — e.g. `docs/specs/019-offline-tiles/plan.md` *(trailhead-offline-c3d4)*

**What's next** — *40m ago*
> 18 of 28 specs done; elevation and offline are the two live fronts before the beta cut.
> **Next:** Finish 014 elevation smoothing, then merge 019 offline tiles and run the Public Beta checklist.

---

## 2. Verdant — plant-care reminders
*Barely started — a dozen specs, only one done. Quiet; carries the calm early-project and the empty states.*

- **Chip:** `active`
- **Needs you:** *nothing needs you*
- **Progress:** **8%**
- **Counts:** 1 done · 0 in progress · 11 draft · **12 specs** · 0 open bugs · 1 deferred decision · 2 inbox

**Specs** *(12 total)*
| id | status | slices |
|---|---|---|
| 001-plant-list | DONE | 2/2 |
| 002-watering-schedule | DRAFT | 0/3 |
| 003-reminder-notifications | DRAFT | 0/2 |
| 004-plant-database | DRAFT | 0/4 |
| … | *(8 more DRAFT)* | |

**Workstreams** — *none yet*

**Sessions** — *none* (no sessions attributed yet — the section is omitted; the project is quiet, last touched about a week ago)

**What's next** — *no snapshot yet*
> *no "what's next" written yet — this is the empty state.*

---

## 3. Beacon — status-page generator
*Finished. Everything shipped.*

- **Chip:** `all specs done`
- **Needs you:** *nothing needs you* (shipped, idle)
- **Progress:** **100%**
- **Counts:** 11 done · 0 in progress · 0 draft · **11 specs** *(1 abandoned, excluded from the count)* · 0 open bugs · 0 deferred decisions · 0 inbox

**Specs**
| id | status | slices |
|---|---|---|
| 001-incident-model | DONE | 3/3 |
| 002-public-page | DONE | 4/4 |
| 003-subscribe-email | DONE | 2/2 |
| 004-uptime-history | DONE | 3/3 |
| 007-sms-alerts | ABANDONED | — |
| … 001–011 | DONE | |

**Workstreams**
- Release Plan: **v1.0 GA** — `release` *(shipped)*

**Sessions** — header: **0 active · 2 older**
| title | branch | worktree | running | last activity |
|---|---|---|---|---|
| Final v1.0 release notes | claude/release-v1 | main | | 6d ago |
| Docs pass before launch | claude/docs-polish | beacon-docs-x9y8 | | 8d ago |

**What's next** — *6d ago · (stale)*
> Shipped v1.0 GA; nothing outstanding.

---

## 4. Ledger — personal finance tracker
*Troubled — open bugs, a blocker, worktree drift, a big inbox.*

- **Chip:** `active`
- **Needs you:** **1 decision waiting on you** (a currency-rounding rule)
- **Progress:** **45%**
- **Counts:** 9 done · 1 in progress · 5 draft · **20 specs** *(2 deferred)* · **4 open bugs** · 12 deferred decisions · 23 inbox

**Specs** *(20 total — notable ones)*
| id | status | slices |
|---|---|---|
| 001-accounts | DONE | 2/2 |
| 002-import-csv | DONE | 3/3 |
| 006-categorization | IN_PROGRESS | 1/4 |
| 008-budgets | DRAFT | 0/3 |
| 011-multi-currency | DEFERRED | — |
| 013-recurring-txns | DEFERRED | — |
| 015-reports | DRAFT | 0/5 |
| … | *(13 more)* | |

**Workstreams**
- Release Plan: **MVP** — `release`
- **Data-migration Runbook** — `runbook · 5 phases`

**Sessions** — header: **4 active · 3 older**
| title | branch | worktree | running | last activity |
|---|---|---|---|---|
| Reconcile double-counted transactions | claude/bug-double-count | ledger-recon-9z8y | ● | 5m ago |
| Currency rounding investigation | claude/bug-rounding | ledger-round-2a3b | ● | 22m ago |
| Category auto-suggest | claude/006-categorization | ledger-cat-4c5d | ● | 1h ago |
| CSV import: odd delimiters | claude/002-csv-fix | main | ● | 3h ago |
| Budget screen sketch | claude/008-budgets | ledger-budget-6e7f | | 4d ago |

**Worktree warning:** ⚠ 7 docs exist only in a worktree — e.g. `docs/bugs/003-currency-rounding.md` *(ledger-round-2a3b)*

**What's next** — *1h ago*
> MVP is 45% in; transaction reconciliation is the current fire.
> **Next:** Land the double-count fix (bug 001), then resume 006 categorization.
> **Blocked:** Waiting on owner decision — which currency-rounding rule to use (bug 003).

---

## 5. Cartographer — map-notes tool
*Steady mid-project, a couple of running sessions, mild overflow.*

- **Chip:** `active`
- **Needs you:** **2 reviews waiting on you** (two finished slices to review)
- **Progress:** **78%**
- **Counts:** 14 done · 2 in progress · 2 draft · **18 specs** · 1 open bug · 3 deferred decisions · 5 inbox

**Specs** *(18 total — notable ones)*
| id | status | slices |
|---|---|---|
| 001-canvas | DONE | 3/3 |
| 002-pins | DONE | 2/2 |
| 009-linked-notes | DONE | 4/4 |
| 016-vector-styling | IN_PROGRESS | 2/3 |
| 017-export-svg | IN_PROGRESS | 1/2 |
| 018-collab-cursors | DRAFT | 0/4 |
| … | *(12 more)* | |

**Workstreams**
- Release Plan: **v0.5** — `release`

**Sessions** — header: **3 active · 4 older (+2 not shown)**  *(9 total, 7 emitted)*
| title | branch | worktree | running | last activity |
|---|---|---|---|---|
| Vector layer styling | claude/016-vector-styling | carto-vec-3m4n | ● | just now |
| SVG export rounding | claude/017-export-svg | carto-svg-5o6p | ● | 18m ago |
| Linked-notes backlinks | claude/009-backlinks | main | ● | 2h ago |
| Pin clustering tweak | claude/002-pin-cluster | carto-pin-7q8r | | 1d ago |
| *(3 more older, then +2 not shown)* | | | | |

**What's next** — *20m ago*
> 14 of 18 specs done; styling and export are wrapping up for v0.5.
> **Next:** Finish 016 vector styling, then cut v0.5 once 017 SVG export lands.

---

## 6. Almanac — habit tracker
*Barely started, but with a big review queue — the "needs you" is loud.*

- **Chip:** `active`
- **Needs you:** **9 specs awaiting your review** (the review queue is the story here)
- **Progress:** **30%**
- **Counts:** 3 done · 0 in progress · 7 draft · **10 specs** · 0 open bugs · 4 deferred decisions · 6 inbox

**Specs** *(10 total)*
| id | status | slices |
|---|---|---|
| 001-habit-model | DONE | 2/2 |
| 002-daily-checkin | DONE | 3/3 |
| 003-streaks | DONE | 2/2 |
| 004-reminders | DRAFT | 0/2 |
| 005-stats | DRAFT | 0/3 |
| … | *(5 more DRAFT, all awaiting review)* | |

**Workstreams** — *none yet*

**Sessions** — header: **0 active · 2 older** *(both in worktrees)*
| title | branch | worktree | running | last activity |
|---|---|---|---|---|
| Streak edge cases | claude/003-streaks | almanac-streak-b2c3 | | 3d ago |
| Reminder scheduling sketch | claude/004-reminders | almanac-remind-d4e5 | | 5d ago |

**What's next** — *3d ago*
> Foundations done; a stack of draft specs is waiting on a review pass before more building.
> **Next:** Review the 9 open drafts and promote the ready ones.

---

## 7. Semaphore — deploy notifier
*Calm and mid-way, but spread across several worktrees. Nothing needs you.*

- **Chip:** `active`
- **Needs you:** *nothing needs you*
- **Progress:** **55%**
- **Counts:** 6 done · 1 in progress · 4 draft · **11 specs** · 0 open bugs · 2 deferred decisions · 3 inbox

**Specs** *(11 total — notable ones)*
| id | status | slices |
|---|---|---|
| 001-webhook-in | DONE | 2/2 |
| 002-slack-out | DONE | 2/2 |
| 006-retry-policy | IN_PROGRESS | 1/3 |
| 008-rate-limits | DRAFT | 0/2 |
| … | *(7 more)* | |

**Workstreams**
- Release Plan: **v0.4** — `release`

**Sessions** — header: **1 active · 3 older** *(spread over 4 worktrees)*
| title | branch | worktree | running | last activity |
|---|---|---|---|---|
| Retry backoff tuning | claude/006-retry-policy | semaphore-retry-f6g7 | ● | 45m ago |
| Slack formatting polish | claude/002-slack-out | semaphore-slack-h8i9 | | 2d ago |
| Rate-limit design notes | claude/008-rate-limits | semaphore-rate-j0k1 | | 3d ago |
| Webhook signature check | claude/001-webhook-sig | semaphore-hook-l2m3 | | 6d ago |

**What's next** — *45m ago*
> Steady progress on delivery reliability; nothing blocked or waiting.
> **Next:** Finish 006 retry policy, then start 008 rate limits.

---

## 8. Kestrel — note-taking app
*Brand new and sparse — one spec, mostly empty. The minimal card.*

- **Chip:** `active`
- **Needs you:** *nothing needs you*
- **Progress:** **50%**
- **Counts:** 1 done · 0 in progress · 1 draft · **2 specs** · 0 open bugs · 0 deferred decisions · 1 inbox

**Specs**
| id | status | slices |
|---|---|---|
| 001-note-editor | DONE | 2/2 |
| 002-search | DRAFT | 0/2 |

**Workstreams** — *none yet*

**Sessions** — header: **1 active · 1 older** *(new, 2 worktrees)*
| title | branch | worktree | running | last activity |
|---|---|---|---|---|
| Editor keybindings | claude/001-note-editor | kestrel-editor-n4o5 | ● | 30m ago |
| Search index spike | claude/002-search | kestrel-search-p6q7 | | 1d ago |

**What's next** — *30m ago*
> Editor works; search is the next piece.
> **Next:** Build the 002 search index.
