# Agent system implementation

Start with the consolidated design, then use your task checklist. The folder records the agreed division of work and the implementation/test requirements, not a claim that every planned capability is already live.

| Document | Purpose |
| --- | --- |
| [Remaining implementation checkpoint](./Eric%20Remaining%20Implementation.md) | Current completed stages, verification evidence and remaining teammate/live gates |
| [Combined system design](./Anchored%20Agent%20System%20Design.md) | Authoritative product design, execution ownership, interfaces and safety requirements |
| [Pramuk tasks](./Pramuk%20Tasks.md) | Shared groundwork, Bookkeeping, Marketing, shared Ask and deployment configuration |
| [Eric tasks](./Eric%20Tasks.md) | Customer, Internal Communications, UI integration and demo |
| [Detailed implementation plan](./Eric%20Agent%20System%20Implementation%20Plan.md) | Stage-by-stage implementation and verification |
| [Three-agent work split](./Eric%20Three-Agent%20Work%20Split.md) | Eric's Customer, Internal and UI worker assignments and shared-file rules |
| [Demo walkthrough](./Eric%20Agent%20Demo%20Walkthrough.md) | Rehearsal sequence, unavailable capabilities and real-provider verification gates |
| [Prior teammate checklist](./Pramukh%20Tasks%20V2%20Reference.md) | Previous detailed checklist retained as reference; use Pramuk tasks for reconciled ownership and migration order |
| [Teammate V2 reference](./Anchored%20Agent%20System%20Design%20V2.md) | Original reference retained for provenance; use the combined design for reconciled decisions |

Eric owns Customer and Internal Communications execution and the owner-facing app. Pramuk owns Bookkeeping, Marketing, shared agent groundwork and shared Ask/cron/environment integration. Shared files have one writer per patch; see the consolidated design for the exact boundaries.

The UI checkpoint `987f690` is on the separate local `feat/agent-dashboard` branch. It is not introduced into main by this documentation PR. Preserve current main when bringing that code forward, including any reversions or later work. Historical local worktree paths and prior authentication notes in the detailed documents describe that checkpoint, not required paths or a current access failure on a teammate's machine.

No live keys are needed for the repository's ordinary tests/build. Live provider verification is a separate authorized test using controlled recipients.

Main now includes migrations `20261108000300_telegram_threads.sql` and `20261108000600_internal_briefs.sql`. Timestamp reservations in the planning documents are historical proposals. Keep merged migrations frozen and choose new files after the newest main timestamp; do not create or renumber groundwork against those old reservations.
