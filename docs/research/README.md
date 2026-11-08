# Research

The team researched three trades before building Anchored, then wrote a design document and a note on where the documents disagree. Documents written before the rename call the project Backroom.

## Across all trades

- [design-document.pdf](design-document.pdf): Eric's design document, built on the HVAC research. It covers goals, business and security risks, C4 context, container and deployment views, and open questions.
- [reconciliation.md](reconciliation.md): Where the research documents conflict, with a proposed call for each conflict, such as simulated demo texts, agent names, auto-send and Maryland quiet hours.
- [ai-tool-platforms.md](ai-tool-platforms.md): Where owners find AI tools today: vendor-funded directories such as G2 and Capterra, AI tool directories, POS and field-service app marketplaces, SBA and SBDC programs, and matching services. It covers who pays each one, how it ranks, what it never checks, five sourced numbers for a slide, and where Anchored fits.

## HVAC

- [hvac-research.pdf](hvac-research.pdf): Eric's report on small HVAC shops. It covers structure, sales, tools, lead channels, where leads leak, pain points, ingestion and onboarding in about 10 minutes.

## Restaurants and corner stores

- [corner-stores-and-restaurants.md](corner-stores-and-restaurants.md): Ricky Chen's report, drawn from the nine notes below. It covers operations, sales, tools, lead leaks, pain points and ingestion, and argues these trades need a different first workflow than coaching.

The notes in [corner-stores-and-restaurants-notes/](corner-stores-and-restaurants-notes/) hold the sourced detail behind that report:

- [adoption_evidence.md](corner-stores-and-restaurants-notes/adoption_evidence.md): How AI and tech adoption has gone at independent restaurants and corner stores, read as a skeptic. It covers measured outcomes, public failures, approval fatigue, trust channels and willingness to pay.
- [connectors_and_limits.md](corner-stores-and-restaurants-notes/connectors_and_limits.md): Which POS, review, delivery and phone sources can feed an approve-first system, and the US and Maryland legal limits on texting, call recording, allergies, labor, SNAP, tobacco and lottery.
- [corner_store_operations.md](corner-stores-and-restaurants-notes/corner_store_operations.md): Corner store counts, revenue and margins, weekly chores, software, compliance, ownership and attitudes to AI.
- [earlier_synthesis.md](corner-stores-and-restaurants-notes/earlier_synthesis.md): An earlier summary that starts owners on existing tools, argues lead follow-up is the wrong first job, and lists twelve things to keep out of any agent.
- [restaurant_operations.md](corner-stores-and-restaurants-notes/restaurant_operations.md): Independent restaurant counts and margins, the owner's chores, the dollar size of each leak, catering, the tech stack and compliance.
- [sales_leads_followup.md](corner-stores-and-restaurants-notes/sales_leads_followup.md): What counts as a lead in each trade, where new guests come from, catering and group orders, and how follow-up works today.
- [tools_and_ingestion.md](corner-stores-and-restaurants-notes/tools_and_ingestion.md): Whether owners use a CRM, each tool's price and data export, the fastest 10-minute ingest, and which inbound channels can capture leads.
- [tools_by_job.md](corner-stores-and-restaurants-notes/tools_by_job.md): AI tools a small restaurant or corner store can buy today, by job, rated on the seven criteria that became the checks in `lib/domain/rating.ts`.
- [typical_day_and_pains.md](corner-stores-and-restaurants-notes/typical_day_and_pains.md): Each owner's day hour by hour, admin hours per week, the yearly cost of each pain, and what owners would never hand to software.

## Coaching

- [coaching-operations.md](coaching-operations.md): Pramukh Bhushan's report on coaching businesses. It covers structure, sales, tools, lead channels, where leads leak, pain points and ingestion, and makes the case for coaching as the second trade.
