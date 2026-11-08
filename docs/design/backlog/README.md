# Design backlog

Designs that are ready but not in the app yet. Nothing here is wired into a page. The owner picks when each one goes in, and only then does it get built into `app/` and `components/`.

## Live as a static preview

| Page | Where | Notes |
| --- | --- | --- |
| Reply to new leads | `public/design/reply-to-new-leads.html`, served at `/design/reply-to-new-leads.html` | One automation's own page with sample data. Static HTML, not linked from the app and not connected to any business. It exists to check how an automation page reads before building the real one |

## Backlog

Open [`workflow-map.html`](workflow-map.html) in a browser to click through every item below. It uses sample data for an example business, Landed HQ.

| # | Item | What it is | Built version |
| --- | --- | --- | --- |
| 1 | Workflows map | The Workflows page as a radial map: the business in the middle, the parts of its day around it, then jobs, then automations, one level at a time. Circles pop on hover and spring back when dragged | `feat/workflow-map`: `components/workflows/WorkflowMap.tsx`, `map.module.css` |
| 2 | Step guide | Above the map: a big title, a three-step progress bar (Pick a part, Pick a job, Watch it work), one plain instruction and a Back button | Inside `WorkflowMap.tsx` on `feat/workflow-map` |
| 3 | Automation overview | Tapping an automation opens a short pop-up: what it does, who does it, the result, and a link to its page | Inside `WorkflowMap.tsx` on `feat/workflow-map` |
| 4 | Automation pages | Each automation gets its own page, like a thread in a project: drafts waiting for the owner's OK, recent runs, how it works, what it never does | `feat/workflow-map`: `app/app/b/[id]/workflows/[workflow]/[automation]/page.tsx` |
| 5 | Sidebar automations | The open business's automations listed under Workflows, grouped by part of the day, with a count of drafts waiting | `feat/workflow-map`: `components/shell/Sidebar.tsx`, `shell-data.ts` |
| 6 | Harbor Chart app theme | The landing page's colors, fonts and 4px corners across the app | `app/globals.css`, scoped to `.theme-harbor` so only the app and sign-in wear it and the home page keeps its own palette |

## Taking an item off the backlog

1. Branch from `origin/main`.
2. Bring over only that item's files from `feat/workflow-map` with `git checkout feat/workflow-map -- <paths>`, and trim anything that belongs to another item.
3. Check it on localhost, including the home page, then open a PR.
