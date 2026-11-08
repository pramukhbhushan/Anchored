# Marketing agent sample data

Test data for the Marketing agent plan in `../marketing_agent.md`. The business is College Park Heating & Air, the HVAC example from `lib/domain/cases.ts`, with the extra profile fields Marketing needs. Today in this data is Nov 8, 2026.

| File | Holds | Used by |
| --- | --- | --- |
| `profile.json` | The business profile, including the proposed `links`, `claims` and `mayNameCustomers` fields | MK2, MK5, MK10 |
| `contacts.json` | Five customers, one with STOP, with last review and review-ask dates | MK7, MK8, MK13 |
| `jobs.json` | `job-done` payloads, with what code should keep and strip | MK2, MK4, MK5 |
| `reviews.json` | Good, mixed, bad, old, malformed and prompt-injection reviews, with the expected tone and flag | MK3, MK4, MK7, MK9 |
| `chat-lines.json` | Owner lines for the business chat, with the expected skill and card | MK11, manual test |
| `model-outputs.json` | Fake model posts and replies that must be refused or kept | MK2, MK3, MK5, MK7 |

Every file has an `_expect` or `expect` field, so a test can load the file and assert against it. All names, emails and links are made up.

Two fields are not in the code yet: the `review` payload's `rating` and `platform` (added in MK4), and the `job-done` source itself. Until MK4 lands, today's strict schema refuses them.

To send a review to the simulator by hand on port 3102 (today's schema takes only `author` and `text`):

```bash
curl -s http://localhost:3102/api/ingest/review -H "Content-Type: application/json" -H "Cookie: <paste>" \
  -d '{"businessId":"<id>","payload":{"author":"Maria Gonzalez","text":"Luis was on time and explained everything."}}'
```
