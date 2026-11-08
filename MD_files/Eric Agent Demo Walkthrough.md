# Eric's agent demo walkthrough

Prepared November 8, 2026. Script for the current dashboard implementation, followed by the live integration checks still required. No video has been recorded as part of this change.

## Current demonstration scope

The new workspaces read the existing active-agent definitions and approval feed. Customer groups Front Desk and Follow-up for presentation. This does not migrate stored agent identities or implement the new agent execution system. General business Chat, comparison/adoption, Approvals, configured service delivery and Marketing copy keep their current code paths.

Agent-scoped Ask, customer history, Telegram setup/QR, acknowledgment authorization and Daily Brief Run now have prepared UI components. They are not connected to the new backend contract. Show their unavailable state where present. Do not narrate a live Telegram conversation, a generated daily brief or an enabled standing rule until the integration checks below pass.

## Rehearsal setup

1. Use Eric's isolated worktree, Node 26 and a dedicated unused port such as 3101. Leave another person's server on port 3000 alone.
2. Run the final combined checks before recording. Build and start the app using the repository instructions. With memory storage, keep the same server process and browser session throughout the rehearsal because restart clears the data.
3. Record whether the run uses configured AI or the rules fallback. If accounts are off, describe the session as this browser; if Supabase accounts are enabled, verify Continue as guest before presenting guest access.
4. Use only synthetic business and customer information. Keep credentials, connection secrets and private messages outside the recording.
5. Prepare a business whose chosen workflows include the desired agent jobs. Only active agents appear, so a business using an outside tool for a job will not necessarily show every core agent. Internal Communications follows the existing always-on domain definition.
6. Rehearse each click and confirm the expected text on the actual server. The timing below is a target, not evidence of a completed rehearsal. Keep a saved list of the real demo URLs after creating the business.

## Ten-minute current-code walkthrough

| Time | Actions | What to explain |
| --- | --- | --- |
| 0:00 to 1:00 | Open the app and Linden Street Kitchen. Point out Overview, the morning summary and the existing sections. | Anchored helps an owner discover, compare and adopt AI tools. Agents draft the jobs the owner chooses to have Anchored handle. The example demonstrates the product; it is not the owner's live customer business. |
| 1:00 to 3:00 | Open Workflows, choose one job, inspect its current handler and compare tools on Tools. Open Stack to show the cost. | Explain the researched evidence, price, data and setup checks. Show that an existing tool can handle a job and that Anchored is one available option. Keep comparison and adoption central to the story. |
| 3:00 to 5:00 | Set up a synthetic business through the existing onboarding. Review the resulting workflows and choose an Anchored draft path for a suitable job. Approve the plan where available. | The owner's information and choices determine which jobs and agents are active. Plan approval does not enable the unconnected acknowledgment rule. |
| 5:00 to 7:00 | Open an active agent from Workflows or the command palette. Inspect its jobs and limits, then use Open Chat. Ask general Chat for a supported draft, return to the workspace and follow the resulting card link to Approvals. Review or edit the draft. | The workspace is a focused view of the same work. There is one approval queue. General Chat currently handles requests; the agent-specific Ask box is awaiting its server contract. A draft and an approval are not evidence of provider delivery. |
| 7:00 to 8:30 | If a Marketing job is active, request a supported post in general Chat, inspect it in Approvals, approve/copy and open its destination. Otherwise show another active agent's existing work. | The owner reviews the exact words. Copying prepares text for the owner's publishing app; it does not publish a post. A clipboard or approval error needs recovery before claiming success. |
| 8:30 to 9:30 | Return to Overview and compare its pending counts with the workspace and Approvals. Open an existing workflow automation detail to demonstrate that its old URL and map link still work. | The existing summary, workflow map and tool-adoption structure remain intact. Recent activity distinguishes approved, waiting, sent, failed, skipped and replaced drafts when those records exist. |
| 9:30 to 10:00 | Show Connections and the explicit unavailable Telegram state. Finish with the usable prototype URL and the remaining integration status. | Customer history, Telegram/QR, the fixed acknowledgment rule and scheduled/on-demand brief still need the new backend. Explain the next integration milestone with no claim of live delivery. |

If onboarding takes longer, use the rehearsed synthetic business and briefly show how it was set up. Do not replace failed live reads with test fixture data during the demonstration.

## Stop and recovery conditions

- Missing agent: check its workflow choice. Do not force a disabled job into the UI or suggest the sidebar grants permission.
- Read or network failure: show the error, retry once and continue only after the actual data returns. A missing business differs from a temporary read failure.
- Card changed or replaced: refresh and review the current card. Do not reuse an old approval result or count a replaced draft as approved.
- Clipboard denied: use the visible approved text and the copy recovery. Say that copying failed until the browser confirms a successful copy.
- No configured delivery service: show the supported outbox next step. Do not label a queued, failed or owner-send entry as sent by Anchored.
- Telegram unavailable or rule state unknown: keep the unavailable state. Do not show a fabricated link/QR, enable a local-only toggle or simulate a provider response as live.
- Private information appears: stop the recording, remove it from the demo setup and restart that segment using synthetic data.

## Live Telegram segment after backend integration

Replace the unavailable-state portion of the script only after Eric and Pramook complete these checks together. Pramook owns the server contract, authorization, persistence, provider setup and execution. Eric owns presentation and records the observed outcomes.

1. Integrate the actual API/read contracts and capabilities. Replace provisional display types as appropriate. Verify that production pages have no fixture fallback and do not call guessed endpoints.
2. Create a guest-owned business, choose its agent workflows and verify its own server-generated Telegram link is visible. The shared example remains distinct from a guest's business.
3. Open the real deep link on a phone. When QR generation is connected, scan it and confirm it opens the exact same business chat. A QR image on screen is not sufficient verification.
4. Start the chat and send a synthetic inquiry. Confirm the selected business and contact, ordered history and pending draft appear in the web app. Check that another business/session cannot see them.
5. Open the card in the single Approvals queue, edit if needed, approve and wait for the real delivery state. Confirm the exact approved reply arrives on the phone. Record queued and sent as separate states.
6. Explicitly approve the displayed fixed acknowledgment template. Verify the saved authorization and an eligible rule-authorized message. Disable it and verify the returned saved state. Confirm the server's treatment of already queued acknowledgments.
7. Send `/stop` from the customer phone. Confirm the stopped state in Customer and verify a later send is blocked. Check blocked-bot handling with Pramook's test procedure.
8. Verify an allergy question becomes locked rather than producing a drafted answer. Verify quiet-hours hold with controlled tests without changing a shared production clock or bypassing a send check.
9. Trigger the supported invoice simulator/webhook path and then its paid event. Confirm pending and queued reminders are canceled, and display the actual resulting activity. Use only the demo's own contact and invoice.
10. Generate and approve/copy a Marketing draft. Verify a review flag or handoff where supported. Do not claim direct Google/Meta publishing.
11. Run the daily brief and compare its returned code-computed counts, amounts and flags with the same business's actual queue. Test a failed refresh retains the last successful brief.
12. If message deletion is included in the agreed contract, verify server-provided eligibility, refusal and result states. Retain audit history; do not claim the customer never saw a deleted message.
13. Test unavailable Telegram configuration, no-AI fallback and network recovery. Remove obsolete unavailable copy only where actual reads and mutations work.
14. Run `npm run check` on the final merged tree and perform the desktop/phone browser pass. Record which checks were component tests, local integration checks and real provider checks.

## Evidence to record before the final video

| Evidence | Record after verification |
| --- | --- |
| Build and test baseline | Commit id, Node version, check result and known limitations |
| Browser pass | Pages/URLs, desktop and phone sizes, no sideways scrolling, keyboard navigation |
| Account mode | Guest sign-in or local browser session, and which business owns the data |
| Provider delivery | Sent record and the corresponding message received on the demo phone |
| Owner control | Card decision, rule approval/disable result, STOP refusal and allergy lock |
| Other agents | Paid-invoice cancellation, approved Marketing copy, actual brief result |
| Recording | Rehearsed timing, final playable video and prototype URL, created only after the demonstrated flows work |

The companion integration checklist is `components/business/agents/integration.md`. This script describes a preliminary dashboard milestone and the remaining path to the live agent demo; it does not certify an unperformed integration test.
