# Agent presentation integration

The workspace and navigation use existing session-scoped `getChoices`, `activeAgents` and `getFeed` reads. Customer is a display projection of legacy Front Desk and Follow-up, not a persisted migration. Production pages never import test fixtures.

The following capabilities are prepared as isolated components and covered by tests. Their production wiring awaits the backend implementation and contract. No proposed endpoint is called speculatively.

| UI surface | Current seam | Backend input needed |
| --- | --- | --- |
| Agent Ask | `ChatWindow` business props `agent`, `agentName` | Business-chat schema and handler supporting an optional validated agent context. Current general Chat sends only `text`. |
| Customer history | `CustomerThreads` and exported display types | Authorized contacts, selected contact and ordered messages, STOP/lock state, card keys and actual delivery status. Selected contact is a query parameter. Read failures must not become an empty history. |
| Telegram test link | `TelegramSetup` props `url`, `unavailableReason`, optional `qrCode` | Server-generated URL for the current business, independent of whether the guest can connect secret-bearing integrations. No credentials in props. |
| QR | `TelegramSetup.qrCode` | A real locally generated QR after selecting a dependency and assigning package/lockfile ownership. No external QR service or fake QR is used. |
| Acknowledgment | `AcknowledgmentRule` props `state`, `save(enabled)` | Current saved authorization and an async browser API adapter that returns authoritative state. `state=null` means unavailable, not off. |
| Brief | `BriefRunButton` props `brief`, `run()` | Code-computed text, generation time and an async browser API adapter. Existing Overview remains the current summary until this exists. |
| Telegram outbox | Presentation channel union includes `telegram` | API outbox/card channel support and real delivery records. Telegram never falls back to personal SMS, email or copying for a private chat. |
| Rule audit and deletion | Not connected | Agreed authorization fields and server-provided deletion eligibility/endpoint. Do not infer permission or the deletion window in the browser. |
| Agent character | Current workspace shows existing job and skill limits | Domain character metadata for voice and agent-specific hard limits. Do not invent backend behavior from display copy. |

For a callback-based control, use a client integration wrapper to call the agreed API with `components/api.ts` helpers. Do not pass ordinary server functions as callbacks across a server/client boundary. Keep API types in `lib/api`, domain rules in `lib/domain`, and all authorization, persistence and provider calls in their existing server layers.

Once backend types exist, replace provisional display-only thread/control types with the agreed API projections. Remove the explicit unavailable messages in the Customer and Connections pages only when real reads and capabilities are connected. Pass `agent` to an Ask box only after the backend validates it. Do not infer agent authorization from a hidden input or sidebar label.

Existing URLs are preserved. Agent pages occupy `workflows/[workflow]/page.tsx`; nested automation pages remain `workflows/[workflow]/[automation]/page.tsx`. The same dynamic segment has different validation at each URL depth. No `[agent]` sibling or folder rename is necessary.

Run component tests first, then `npm run check`, then verify the real guest-business message, approval, dispatch, STOP, allergy, invoice cancellation, Marketing copy and brief flows with both halves integrated. Fixture tests do not prove provider delivery.
