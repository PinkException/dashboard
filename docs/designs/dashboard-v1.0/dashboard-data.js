// dashboard v1.0
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
