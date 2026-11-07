# Anchored research: where the docs disagree

Nov 7, 2026 · @Ricky Chen

Four research docs feed Anchored: Eric's [design doc](design-document.pdf) and [HVAC research](hvac-research.pdf), Pramukh's [coaching research](coaching-operations.md), and the [corner store and restaurant research](corner-stores-and-restaurants.md) with its nine notes. We wrote them in parallel, so they disagree in places. Each item below names a conflict and proposes a call. The first three need an answer before the Nov 8 demo.

All four docs still say Backroom, and this note uses Anchored. The coaching and store docs build on a blueprint artifact that I could not open, so anything this note says about the blueprint comes from what those two docs quote.

## Settle before the Nov 8 demo

### 1. A Twilio trial cannot send the demo's texts

The design doc expects carrier registration, called A2P 10DLC, to miss the build weekend. It plans to send real texts only to the team's verified numbers. The store research found that a Twilio trial sends to at most 5 verified numbers and does not allow custom message bodies. Every drafted card is a custom body. Twilio's [error 30034](https://www.twilio.com/docs/api/errors/30034) also blocks texts to US numbers from any sender without an approved campaign.

**Proposal.** Show outbound texts on a simulated phone that says on screen it is simulated. Switch to a paid, registered account only if registration clears in time, since Twilio's review time is unconfirmed. Missed-call capture needs no registration, so only the outgoing text has to be simulated.

### 2. Two sets of names describe one loop

The design doc names ten agents, including Callback, First Reply, Closer, and Keeper. It splits the system into a worker that proposes cards, a guardrail service, and an outbound sender that alone can send. The coaching and store docs use the blueprint's names instead: Lead Runner, Quote Chaser, `propose_card`, the Executor, and `/api/ingest/*`. Their demo persona is Tom. The fields `leads.move_date` and `leads.size` and the coaching doc's "for movers" line suggest Tom runs a moving company, not an HVAC shop. The coaching doc also calls Tom's loop "already built".

**Proposal.** Keep the names the code already uses, so check the build before renaming anything. Then write one mapping into the design doc. My reading is that `propose_card` is the worker's card output, and the Executor is the outbound sender plus the guardrail service. Lead Runner covers Callback and First Reply, and Quote Chaser is Closer. The Executor runs four action types: `send_sms`, `send_email`, `update_lead`, and `append_sheet_row`. The design doc's sender sends only SMS, so it needs the other three.

### 3. The demo keeps adding businesses

The design doc demos one synthetic business, College Park Heating & Air. The coaching doc adds a coach as a "third persona". The store doc adds a corner store and a 20-second switch to a restaurant.

**Proposal.** Demo HVAC end to end first. If time remains, add the store's invoice card next. It sends no customer text, so item 1 does not block it, and the store doc estimates 3 to 5 hours for it.

## Settle before real customers

### 4. Auto-send trusts a signal the research calls weak

The design doc offers auto-send for a card type after 20 approvals with no edits. The store research found that acceptance falls as request volume rises and that people end up accepting almost everything. It treats a high approval rate as a warning and caps requests at 3 to 5 a day. Twenty unedited taps can measure fatigue instead of quality.

**Proposal.** Keep approve-every-card as the default. Before offering auto-send, check the edit rate, the skip rate, and the time to decide, which the store doc already proposes to report. Add the daily cap.

### 5. Batch texts assume consent nobody recorded

The HVAC Reactivator drafts a tune-up text to "312 past customers", and Keeper sends renewal texts in batches. The design doc makes the business responsible for consent on the contacts it imports. The store research sets consent to unknown on import, so nothing gets texted. It also found that Twilio requires prior express written consent for promotional texts. A fall tune-up offer is promotional.

**Proposal.** Tag every outgoing text as informational or promotional. Block a promotional send when the contact has no written-consent record. The design doc already stores the consent source for each contact, so the check has the data it needs.

### 6. After-hours text-back meets Maryland's quiet hours

The HVAC research sends the missed-call text-back after hours and on weekends. The demo business uses a 301 area code in College Park, Maryland. Maryland bars telephone solicitations from 8 p.m. to 8 a.m., and its consent definition covers texts. No case or law-firm memo says whether a reply to a missed call counts as a solicitation. Maryland exempts a single reply to a customer's inquiry, but nobody has ruled that a missed call is an inquiry. This is research, not legal advice.

**Proposal.** Set the guardrail's quiet hours to 8 p.m. to 8 a.m. Use the safest form from the connectors note, which is one text with no offer, the business name, and STOP language. Holding texts until 8 a.m. loses some of the after-hours emergency leads the HVAC research counts on, so get a lawyer's read before launching in Maryland.

### 7. The store research disagrees with itself on the next market

The store doc tells Anchored to aim at shops that Square's and Toast's agents do not reach, which it lists as no POS, NRS, Modisoft, and Clover. Its adoption note recommends counter-service restaurants that take phone orders and already run Square, Toast, or Clover. That note keeps the corner store as a second path through a partner.

**Proposal.** A counter-service restaurant on Clover satisfies both. It takes phone orders, has a POS to read, and sits outside Square's and Toast's agents. Clover's sandbox is open to anyone. Coaching needs the fewest changes of any trade, so weigh it against the Clover restaurant before picking.

### 8. Each doc follows up on a different schedule

HVAC follows up on day 1, 5, and 10. The blueprint and coaching use day 1, 3, and 7. Catering uses day 1, day 3, and week 1, then stops.

**Proposal.** Make the schedule a field in each trade's template, which the coaching doc's "one template file per vertical" already allows. Stop after three touches unless the customer replies, since the store research found that a longer chase adds legal exposure.

## Smaller fixes

- Drop Gmail OAuth from the coaching ingest table. The `gmail.readonly` scope needs a yearly security assessment, and all three trades can use a forwarding address instead.
- Every doc targets onboarding in about 10 minutes, and nobody has timed it. The store doc says to time it with three owners before quoting it.
- No doc contradicts another on approve-first cards, customer text as untrusted input, one ingest path for every source, or matching customers by phone number first. The coaching and store docs both ask for a `details` JSON field on `leads`.
