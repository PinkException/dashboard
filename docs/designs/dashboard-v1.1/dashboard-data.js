// dashboard v1.1
// --- v1.0 data, kept intact for the unchanged Product direction ---
window.DASHBOARD_DATA = {
  totals: { projects: 5, specsInFlight: 9, openBugs: 8 },
  projects: [
    { name: 'Aurora',    type: 'mobile app',            done: 7, total: 9, note: null,          bugs: 2, workstream: 'Onboarding flow', lastActivity: '2h ago' },
    { name: 'Ledger',    type: 'finance API',           done: 5, total: 5, note: null,          bugs: 0, workstream: null,               lastActivity: '3d ago' },
    { name: 'Trailhead', type: 'hiking-trails web app', done: 2, total: 6, note: '1 in review', bugs: 4, workstream: 'Map view',         lastActivity: 'just now' },
    { name: 'Beacon',    type: 'notifications service', done: 0, total: 3, note: '3 in draft',  bugs: 1, workstream: 'Spec drafting',    lastActivity: 'yesterday' },
    { name: 'Cadence',   type: 'scheduling app',        done: 4, total: 4, note: null,          bugs: 1, workstream: null,               lastActivity: '1w ago' }
  ],
  aurora: {
    specs: [
      { n: '001', name: 'Adopt jig',           status: 'Done',           slices: null },
      { n: '002', name: 'Two-layer redline',   status: 'In progress',    slices: '7 of 9 slices' },
      { n: '003', name: 'Picture to redline',  status: 'In review',      slices: null },
      { n: '004', name: 'Token export',        status: 'Done',           slices: null },
      { n: '005', name: 'Onboarding',          status: 'Ready to build', slices: null },
      { n: '006', name: 'States & responsive', status: 'Draft',          slices: null }
    ],
    bugs: [
      { id: 'BUG-014', title: 'Timer drifts after resume',                    severity: 'high', status: 'diagnosing' },
      { id: 'BUG-021', title: 'Empty state overlaps footer on small screens', severity: 'low',  status: 'fixing' }
    ],
    activity: [
      'Slice 002-03 moved to Reviewed — 2h ago',
      'BUG-021 reproduced — 5h ago',
      'Spec 004 shipped — yesterday',
      'Slice 002-02 shipped — 2d ago'
    ]
  }
};

// --- v1.1 Console: the everyday all-projects triage view (sample-data.md) ---
// needs.kind: 'decision' | 'review' | null ; needs.blocked distinguishes Ledger.
window.CONSOLE_DATA = {
  projects: [
    {
      id: 'trailhead', name: 'Trailhead', type: 'hiking route planner', chip: 'active',
      needs: { count: 1, kind: 'decision', blocked: false, label: 'decision parked on you', detail: 'A routing-engine choice' },
      progress: { pct: 62 },
      whatsNext: {
        line: '18 of 28 specs done; elevation and offline are the two live fronts before the beta cut.',
        next: 'Finish 014 elevation smoothing, then merge 019 offline tiles and run the Public Beta checklist.',
        blocked: null, age: '40m ago', stale: false
      },
      active: { running: true, activeSessions: 6, lastTouched: 'just now' },
      counts: { done: 18, inProgress: 3, draft: 7, total: 28, bugs: 2, deferred: 9, inbox: 14 },
      specs: [
        { n: '001', name: 'core-map',          status: 'DONE',        slices: '4/4' },
        { n: '002', name: 'route-drawing',     status: 'DONE',        slices: '3/3' },
        { n: '003', name: 'waypoints',         status: 'DONE',        slices: '2/2' },
        { n: '014', name: 'elevation-profile', status: 'IN_PROGRESS', slices: '2/4' },
        { n: '019', name: 'offline-tiles',     status: 'IN_PROGRESS', slices: '1/3' },
        { n: '021', name: 'gpx-import',        status: 'IN_PROGRESS', slices: '0/2' },
        { n: '022', name: 'trail-conditions',  status: 'DRAFT',       slices: '0/2' },
        { n: '025', name: 'social-share',      status: 'DEFERRED',    slices: '—'   },
        { n: '027', name: '3d-flyover',        status: 'DRAFT',       slices: '0/5' }
      ],
      specsMore: 19,
      workstreams: [
        { title: 'Public Beta (v0.9)',        kind: 'release' },
        { title: 'iOS App Store submission',  kind: 'release' },
        { title: 'Onboarding Runbook',        kind: 'runbook · 8 phases' }
      ],
      discovered: ['Weather-overlay spike (2/6)', 'Import-format survey (0/4)'],
      sessions: {
        activeCount: 6, olderCount: 14, notShown: 51,
        rows: [
          { title: 'Elevation profile smoothing', branch: 'claude/014-elevation-smoothing', worktree: 'trailhead-elev-a1b2',   running: true,  last: 'just now' },
          { title: 'Offline tile cache eviction', branch: 'claude/019-offline-tiles',        worktree: 'trailhead-offline-c3d4', running: true,  last: '12m ago'  },
          { title: 'GPX import edge cases',        branch: 'claude/021-gpx-import',           worktree: 'trailhead-gpx-e5f6',     running: true,  last: '38m ago'  },
          { title: 'Fix route snapping jitter',    branch: 'claude/bug-route-snap',           worktree: 'main',                   running: true,  last: '1h ago'   },
          { title: 'Beta release checklist',       branch: 'claude/release-beta-prep',        worktree: 'trailhead-beta-7h8i',    running: true,  last: '2h ago'   },
          { title: 'Trail-conditions API research',branch: 'claude/022-conditions',           worktree: 'trailhead-cond-9j0k',    running: true,  last: '4h ago'   },
          { title: 'Waypoint drag polish',         branch: 'claude/003-waypoint-polish',      worktree: 'trailhead-way-l1m2',     running: false, last: '2d ago'   }
        ]
      },
      worktreeWarning: { count: 3, example: 'docs/specs/019-offline-tiles/plan.md', worktree: 'trailhead-offline-c3d4' },
      bugs: []
    },
    {
      id: 'ledger', name: 'Ledger', type: 'personal finance tracker', chip: 'active',
      needs: { count: 1, kind: 'decision', blocked: true, label: 'decision waiting on you', detail: 'Which currency-rounding rule to use' },
      progress: { pct: 45 },
      whatsNext: {
        line: 'MVP is 45% in; transaction reconciliation is the current fire.',
        next: 'Land the double-count fix (bug 001), then resume 006 categorization.',
        blocked: 'Waiting on owner decision — which currency-rounding rule to use (bug 003).',
        age: '1h ago', stale: false
      },
      active: { running: true, activeSessions: 4, lastTouched: '5m ago' },
      counts: { done: 9, inProgress: 1, draft: 5, total: 20, bugs: 4, deferred: 12, inbox: 23 },
      specs: [
        { n: '001', name: 'accounts',       status: 'DONE',        slices: '2/2' },
        { n: '002', name: 'import-csv',      status: 'DONE',        slices: '3/3' },
        { n: '006', name: 'categorization',  status: 'IN_PROGRESS', slices: '1/4' },
        { n: '008', name: 'budgets',         status: 'DRAFT',       slices: '0/3' },
        { n: '011', name: 'multi-currency',  status: 'DEFERRED',    slices: '—'   },
        { n: '013', name: 'recurring-txns',  status: 'DEFERRED',    slices: '—'   },
        { n: '015', name: 'reports',         status: 'DRAFT',       slices: '0/5' }
      ],
      specsMore: 13,
      workstreams: [
        { title: 'MVP',                    kind: 'release' },
        { title: 'Data-migration Runbook', kind: 'runbook · 5 phases' }
      ],
      discovered: [],
      sessions: {
        activeCount: 4, olderCount: 3, notShown: 0,
        rows: [
          { title: 'Reconcile double-counted transactions', branch: 'claude/bug-double-count', worktree: 'ledger-recon-9z8y',  running: true,  last: '5m ago'  },
          { title: 'Currency rounding investigation',       branch: 'claude/bug-rounding',     worktree: 'ledger-round-2a3b',  running: true,  last: '22m ago' },
          { title: 'Category auto-suggest',                 branch: 'claude/006-categorization',worktree: 'ledger-cat-4c5d',    running: true,  last: '1h ago'  },
          { title: 'CSV import: odd delimiters',            branch: 'claude/002-csv-fix',      worktree: 'main',               running: true,  last: '3h ago'  },
          { title: 'Budget screen sketch',                  branch: 'claude/008-budgets',      worktree: 'ledger-budget-6e7f', running: false, last: '4d ago'  }
        ]
      },
      worktreeWarning: { count: 7, example: 'docs/bugs/003-currency-rounding.md', worktree: 'ledger-round-2a3b' },
      bugs: [
        { id: 'bug 001', title: 'Double-counted transactions', severity: 'high', status: 'fixing' },
        { id: 'bug 003', title: 'Currency-rounding rule',      severity: 'high', status: 'blocked on decision' }
      ]
    },
    {
      id: 'almanac', name: 'Almanac', type: 'habit tracker', chip: 'active',
      needs: { count: 9, kind: 'review', blocked: false, label: 'specs awaiting your review', detail: 'The review queue is the story here' },
      progress: { pct: 30 },
      whatsNext: {
        line: 'Foundations done; a stack of draft specs is waiting on a review pass before more building.',
        next: 'Review the 9 open drafts and promote the ready ones.',
        blocked: null, age: '3d ago', stale: false
      },
      active: { running: false, activeSessions: 0, lastTouched: '3d ago' },
      counts: { done: 3, inProgress: 0, draft: 7, total: 10, bugs: 0, deferred: 4, inbox: 6 },
      specs: [
        { n: '001', name: 'habit-model',   status: 'DONE',  slices: '2/2' },
        { n: '002', name: 'daily-checkin', status: 'DONE',  slices: '3/3' },
        { n: '003', name: 'streaks',       status: 'DONE',  slices: '2/2' },
        { n: '004', name: 'reminders',     status: 'DRAFT', slices: '0/2' },
        { n: '005', name: 'stats',         status: 'DRAFT', slices: '0/3' }
      ],
      specsMore: 5,
      workstreams: [],
      discovered: [],
      sessions: {
        activeCount: 0, olderCount: 2, notShown: 0,
        rows: [
          { title: 'Streak edge cases',         branch: 'claude/003-streaks',   worktree: 'almanac-streak-b2c3', running: false, last: '3d ago' },
          { title: 'Reminder scheduling sketch',branch: 'claude/004-reminders', worktree: 'almanac-remind-d4e5', running: false, last: '5d ago' }
        ]
      },
      worktreeWarning: null,
      bugs: []
    },
    {
      id: 'cartographer', name: 'Cartographer', type: 'map-notes tool', chip: 'active',
      needs: { count: 2, kind: 'review', blocked: false, label: 'reviews waiting on you', detail: 'Two finished slices to review' },
      progress: { pct: 78 },
      whatsNext: {
        line: '14 of 18 specs done; styling and export are wrapping up for v0.5.',
        next: 'Finish 016 vector styling, then cut v0.5 once 017 SVG export lands.',
        blocked: null, age: '20m ago', stale: false
      },
      active: { running: true, activeSessions: 3, lastTouched: 'just now' },
      counts: { done: 14, inProgress: 2, draft: 2, total: 18, bugs: 1, deferred: 3, inbox: 5 },
      specs: [
        { n: '001', name: 'canvas',         status: 'DONE',        slices: '3/3' },
        { n: '002', name: 'pins',           status: 'DONE',        slices: '2/2' },
        { n: '009', name: 'linked-notes',   status: 'DONE',        slices: '4/4' },
        { n: '016', name: 'vector-styling', status: 'IN_PROGRESS', slices: '2/3' },
        { n: '017', name: 'export-svg',     status: 'IN_PROGRESS', slices: '1/2' },
        { n: '018', name: 'collab-cursors', status: 'DRAFT',       slices: '0/4' }
      ],
      specsMore: 12,
      workstreams: [
        { title: 'v0.5', kind: 'release' }
      ],
      discovered: [],
      sessions: {
        activeCount: 3, olderCount: 4, notShown: 2,
        rows: [
          { title: 'Vector layer styling',   branch: 'claude/016-vector-styling', worktree: 'carto-vec-3m4n', running: true,  last: 'just now' },
          { title: 'SVG export rounding',     branch: 'claude/017-export-svg',     worktree: 'carto-svg-5o6p', running: true,  last: '18m ago'  },
          { title: 'Linked-notes backlinks',  branch: 'claude/009-backlinks',      worktree: 'main',           running: true,  last: '2h ago'   },
          { title: 'Pin clustering tweak',    branch: 'claude/002-pin-cluster',    worktree: 'carto-pin-7q8r', running: false, last: '1d ago'   }
        ]
      },
      worktreeWarning: null,
      bugs: []
    },
    {
      id: 'semaphore', name: 'Semaphore', type: 'deploy notifier', chip: 'active',
      needs: { count: 0, kind: null, blocked: false, label: '', detail: '' },
      progress: { pct: 55 },
      whatsNext: {
        line: 'Steady progress on delivery reliability; nothing blocked or waiting.',
        next: 'Finish 006 retry policy, then start 008 rate limits.',
        blocked: null, age: '45m ago', stale: false
      },
      active: { running: true, activeSessions: 1, lastTouched: '45m ago' },
      counts: { done: 6, inProgress: 1, draft: 4, total: 11, bugs: 0, deferred: 2, inbox: 3 },
      specs: [
        { n: '001', name: 'webhook-in',   status: 'DONE',        slices: '2/2' },
        { n: '002', name: 'slack-out',    status: 'DONE',        slices: '2/2' },
        { n: '006', name: 'retry-policy', status: 'IN_PROGRESS', slices: '1/3' },
        { n: '008', name: 'rate-limits',  status: 'DRAFT',       slices: '0/2' }
      ],
      specsMore: 7,
      workstreams: [
        { title: 'v0.4', kind: 'release' }
      ],
      discovered: [],
      sessions: {
        activeCount: 1, olderCount: 3, notShown: 0,
        rows: [
          { title: 'Retry backoff tuning',     branch: 'claude/006-retry-policy', worktree: 'semaphore-retry-f6g7', running: true,  last: '45m ago' },
          { title: 'Slack formatting polish',  branch: 'claude/002-slack-out',    worktree: 'semaphore-slack-h8i9', running: false, last: '2d ago'  },
          { title: 'Rate-limit design notes',  branch: 'claude/008-rate-limits',  worktree: 'semaphore-rate-j0k1',  running: false, last: '3d ago'  },
          { title: 'Webhook signature check',  branch: 'claude/001-webhook-sig',  worktree: 'semaphore-hook-l2m3',  running: false, last: '6d ago'  }
        ]
      },
      worktreeWarning: null,
      bugs: []
    },
    {
      id: 'kestrel', name: 'Kestrel', type: 'note-taking app', chip: 'active',
      needs: { count: 0, kind: null, blocked: false, label: '', detail: '' },
      progress: { pct: 50 },
      whatsNext: {
        line: 'Editor works; search is the next piece.',
        next: 'Build the 002 search index.',
        blocked: null, age: '30m ago', stale: false
      },
      active: { running: true, activeSessions: 1, lastTouched: '30m ago' },
      counts: { done: 1, inProgress: 0, draft: 1, total: 2, bugs: 0, deferred: 0, inbox: 1 },
      specs: [
        { n: '001', name: 'note-editor', status: 'DONE',  slices: '2/2' },
        { n: '002', name: 'search',      status: 'DRAFT', slices: '0/2' }
      ],
      specsMore: 0,
      workstreams: [],
      discovered: [],
      sessions: {
        activeCount: 1, olderCount: 1, notShown: 0,
        rows: [
          { title: 'Editor keybindings', branch: 'claude/001-note-editor', worktree: 'kestrel-editor-n4o5', running: true,  last: '30m ago' },
          { title: 'Search index spike', branch: 'claude/002-search',      worktree: 'kestrel-search-p6q7', running: false, last: '1d ago'  }
        ]
      },
      worktreeWarning: null,
      bugs: []
    },
    {
      id: 'verdant', name: 'Verdant', type: 'plant-care reminders', chip: 'active',
      needs: { count: 0, kind: null, blocked: false, label: '', detail: '' },
      progress: { pct: 8 },
      whatsNext: {
        line: '', next: null, blocked: null, age: null, stale: false, none: true
      },
      active: { running: false, activeSessions: 0, lastTouched: '~1w ago' },
      counts: { done: 1, inProgress: 0, draft: 11, total: 12, bugs: 0, deferred: 1, inbox: 2 },
      specs: [
        { n: '001', name: 'plant-list',             status: 'DONE',  slices: '2/2' },
        { n: '002', name: 'watering-schedule',      status: 'DRAFT', slices: '0/3' },
        { n: '003', name: 'reminder-notifications', status: 'DRAFT', slices: '0/2' },
        { n: '004', name: 'plant-database',         status: 'DRAFT', slices: '0/4' }
      ],
      specsMore: 8,
      workstreams: [],
      discovered: [],
      sessions: { activeCount: 0, olderCount: 0, notShown: 0, rows: [] },
      worktreeWarning: null,
      bugs: []
    },
    {
      id: 'beacon', name: 'Beacon', type: 'status-page generator', chip: 'all specs done',
      needs: { count: 0, kind: null, blocked: false, label: '', detail: '' },
      progress: { pct: 100 },
      whatsNext: {
        line: 'Shipped v1.0 GA; nothing outstanding.',
        next: null, blocked: null, age: '6d ago', stale: true
      },
      active: { running: false, activeSessions: 0, lastTouched: '6d ago' },
      counts: { done: 11, inProgress: 0, draft: 0, total: 11, bugs: 0, deferred: 0, inbox: 0 },
      specs: [
        { n: '001', name: 'incident-model', status: 'DONE',      slices: '3/3' },
        { n: '002', name: 'public-page',    status: 'DONE',      slices: '4/4' },
        { n: '003', name: 'subscribe-email', status: 'DONE',     slices: '2/2' },
        { n: '004', name: 'uptime-history', status: 'DONE',      slices: '3/3' },
        { n: '007', name: 'sms-alerts',     status: 'ABANDONED', slices: '—'   }
      ],
      specsMore: 6,
      workstreams: [
        { title: 'v1.0 GA', kind: 'release · shipped' }
      ],
      discovered: [],
      sessions: {
        activeCount: 0, olderCount: 2, notShown: 0,
        rows: [
          { title: 'Final v1.0 release notes', branch: 'claude/release-v1',  worktree: 'main',            running: false, last: '6d ago' },
          { title: 'Docs pass before launch',  branch: 'claude/docs-polish', worktree: 'beacon-docs-x9y8',running: false, last: '8d ago' }
        ]
      },
      worktreeWarning: null,
      bugs: []
    }
  ]
};
