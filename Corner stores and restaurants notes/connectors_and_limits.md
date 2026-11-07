# Connectors and legal limits for agents inside a restaurant or corner store

As of Nov 6, 2026. US and Maryland only. This is research, not legal advice. Unsettled points say "unsettled."

These notes test each data source and legal limit against one kind of system: software that turns outside events into drafted tasks, and plain code that carries out an action only after the owner approves. The notes call this "an approve-first system."

How to read the evidence tags:

- [verbatim]: I pulled the raw page text and copied the words from it.
- [page]: I opened the page, but a summarizing fetch tool returned it. Short quotes are likely exact. Check them against the page before relying on them.
- [snippet]: seen only in a search result summary. I did not open the page, or the site refused the fetch.
- [analysis]: law firm or vendor commentary, not a primary source.
- [secondary, source not reopened]: carried over from an earlier secondary note. I could not trace the original source.

Limits of this run: the session's web search budget ran out partway through. Direct page fetches still worked, but these areas got no search at all: FTC follow-up, state AI disclosure, the SNAP handbook, Maryland tobacco pricing, Maryland lottery advertising and alcohol rules. Their Gaps entries say so. Sites that refused the fetch: fns.usda.gov, Toast's terms and FAQ pages, Twilio's help center, leginfo.legislature.ca.gov, law.justia.com, ecfr.gov, Annals of Allergy, Steptoe, ABA.

## Which events can really feed an approve-first system, and what is the verdict per connector?

### Takeaway
Three inputs need no partner approval: a phone photo of an invoice, a CSV export, and a Square Sandbox link seeded with fake data. A missed call can be captured live on Twilio, but the text that follows hits a Twilio limit, so test it first. Toast, Google Business Profile and all three delivery apps have an approval gate with no published time, so they belong on the longer path to production.

### Cited findings

Connector table. Time figures are my estimates, not sourced facts. Facts behind each row are cited in the sections below.

| Connector | What it provides | Access path | Cost to connect | Works without partner approval? | Path to production | Verdict |
|---|---|---|---|---|---|---|
| Invoice photo | Vendor, lines, total | Upload in a phone web app, then Claude vision, then a Zod schema check | About $1.30 per 1,000 images at Haiku 4.5 rates for a 1000x1000 image, more on Sonnet. No partner | Yes. Estimate: 3 to 5 hours | Add per-vendor price history and a supplier view | Build it. Best no-integration input |
| CSV upload (NRS, Modisoft, Sheets, delivery portal exports) | Sales, items | Owner exports, uploads | $0 | Yes. Estimate: 1 to 2 hours, with labeled fake data | Per-POS column maps | Build it. Covers stores with no API |
| Square Sandbox | `order.created`, `inventory.count.updated`, `catalog.version.updated`, `labor.timecard.*`, `labor.scheduled_shift.*`, `payment.*` | Free developer account, seed script, sandbox webhooks | $0 in sandbox | Yes. Estimate: 3 to 6 hours. Label "Square Sandbox, test data" | Production OAuth with one real seller | Build if time allows |
| Twilio voice, missed call | Caller, time, status | Twilio number, `<Dial>` with `action`, branch on `DialCallStatus` | $1.15 per month plus $0.0085 per inbound minute | Yes for the event. Estimate: 2 to 3 hours. Trial limits on inbound were not confirmed | Shop forwards its line on no answer | Build the event. Do not record |
| Twilio SMS, text-back and customer texts | Inbound customer texts, and outbound texts sent after approval | Paid account plus A2P 10DLC, or a labeled simulated phone | $19.50 one time plus $2 per month as sole proprietor, plus about $0.012 per text [snippet for fees] | Risky. See the Twilio section | Registered campaign per shop | Test first. Keep the simulated phone ready |
| Clover sandbox | Orders, inventory | Self-serve sandbox, test token | $0, test merchants are "non-billable" | Yes, but adds nothing over Square | App Market approval, time not stated | Skip at first |
| Toast Standard API | Orders, menus by polling | Restaurant creates read-only credentials itself | Needs Restaurant Management Essentials or higher | No. No sandbox, and you must be a location employee | One live restaurant, with Toast's written OK | Later stage only |
| Toast partner API | Full | Application, vetting, signed agreement, certification, alpha, beta | No public fee or time | No | Estimate: unlikely to finish within a few months | Apply only if a live deployment demands it |
| NRS, Modisoft | CSV only | No public developer docs found. NRS states Excel/CSV export | $0 | Yes, by CSV, with fake data | Ask each vendor about partner access | CSV path only |
| Google Business Profile API | New reviews | Verified profile 60+ days old, website, form, quota 0 until approved | $0, review time not stated | No, unless already approved | Apply early with a real owner | Later stage only. Until then, use owner-pasted reviews, labeled |
| DoorDash, Uber Eats, Grubhub | Orders, reports | Partner approval. DoorDash reviews quarterly | No direct path for a small shop | No | CSV from merchant portals, or middleware | Later stage only |
| WhatsApp, iMessage, native SMS staff chats | None | Cannot read an existing group | N/A | No. Use a mock chat | New GroupMe or Twilio group with staff notice | Use a mock |
| No POS at all | Invoice photo, missed call, owner voice note, CSV | Nothing to connect | Same as those rows | Yes | Same | This is the default corner store path |

### Inferences
- The clearest case for an approve-first system is a corner store with no POS API running on invoice photos and missed calls, since it needs no vendor's permission.
- Suggested hard list for an approve-first system, in plain code and before any send: no customer text unless a consent flag is set, quiet hours 8 p.m. to 8 a.m., a STOP list, a denylist for tobacco, vape, alcohol and lottery content, and no drafted reply at all when a message mentions an allergen. Each comes from the law and platform sections below.

### Gaps
- Actual build times are unknown until someone tries them. Treat the hours above as guesses.

## Square: orders, catalog, inventory, labor, webhooks, sandbox and seeded data

### Takeaway
A read-only Square test works without partner approval. The Sandbox is free and has webhooks, but it does not come with useful data, so plan to run a seed script. Square's developer terms now address AI directly: no training, and you carry the risk of what you send to a model.

### Cited findings
- The Sandbox is "a free, isolated server environment," with unlimited free API calls. [Square Sandbox overview](https://developer.squareup.com/docs/devtools/sandbox/overview) [page]
- A default test account is created for you, plus up to 10 more, each able to be authorized with specific OAuth scopes. [Square Sandbox overview](https://developer.squareup.com/docs/devtools/sandbox/overview) [page]
- Sandbox gaps: no hardware, no Square Point of Sale, no Square for Restaurants, limited dashboard, and "Don't store personal data in the Sandbox." Sandbox webhooks are supported. [Square Sandbox overview](https://developer.squareup.com/docs/devtools/sandbox/overview) [page]
- Seeded data: no. Square staff wrote in 2022 "we don't have a tool that would seed data for your sandbox account." [Square forum](https://developer.squareup.com/forums/t/is-there-a-way-to-enter-bulk-data-into-the-sandbox/4065) [page, dated]. A search summary also cites a forum post from roughly 300 days ago saying seed data is not available in the sandbox, but I did not identify or open that post. [snippet, no direct link]
- Square's sample does the seeding: `python ./seed-data.py --seed` creates customers, catalog items, inventory counts and one order per item. [Build a Sales Report](https://developer.squareup.com/docs/commerce/scenarios/simple-sales-report) [page]. One forum thread title says the example scenarios are out of date, so test early. [Square forum](https://developer.squareup.com/forums/t/example-technical-scenarios-out-of-date-and-dont-work/25079) [snippet]
- Webhook events: `order.created`, `order.updated`, `order.fulfillment.updated`, `catalog.version.updated`, `inventory.count.updated`, `labor.scheduled_shift.created/updated/published/deleted`, `labor.timecard.created/updated/deleted`, `payment.created/updated`, `customer.created/updated/deleted`. `labor.shift.*` is deprecated since 2025-05-21. [Square webhook reference](https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref) [page]
- Read scopes: `ORDERS_READ`, `ITEMS_READ`, `INVENTORY_READ`, `TIMECARDS_READ`, `TIMECARDS_SETTINGS_READ`, `EMPLOYEES_READ`, `MERCHANT_PROFILE_READ`, `CUSTOMERS_READ`. [Square permissions](https://developer.squareup.com/docs/oauth-api/square-permissions) [page]
- Developer terms: "don't use Square Content or data to train or otherwise enhance any AI System." [Square Developer Terms](https://squareup.com/us/en/legal/general/developers) [verbatim]
- Developer terms on outside models: "any data shared with a third party AI System is directed by you," and you accept risks "including risks relating to data security incidents, prompt injection, model hallucination, and unintended automated actions." [Square Developer Terms](https://squareup.com/us/en/legal/general/developers) [verbatim]
- Access only as the seller allows, and if a seller revokes you must delete their content. [Square Developer Terms](https://squareup.com/us/en/legal/general/developers) [page]

### Inferences
- The default test account has unrestricted access, so a personal token does not prove "read-only." To show read-only honestly, authorize a test account through OAuth with only the `*_READ` scopes.
- Sending an order to Claude to draft a task is allowed by the third-party AI clause but is at the developer's risk. Anthropic's commercial terms say it "may not train models on Customer Content," which fits Square's ban. [Anthropic commercial terms](https://www.anthropic.com/legal/commercial-terms) [page]
- A shop on Square for Restaurants cannot be simulated in the Sandbox, so a test should say "retail or counter service test data."

### Gaps
- Whether a real seller connection needs an App Marketplace listing or only OAuth was not checked.
- Rate limits for webhooks were not stated on the pages I read.

## Toast, Clover, NRS, Modisoft and stores with no POS

### Takeaway
A restaurant on Toast can make its own read-only credentials, but an outside developer who is not an employee of the location cannot, and Toast gives no sandbox for that tier. Clover is open to anyone in sandbox. I found no public API for NRS or Modisoft, so those stores use CSV and photos.

### Cited findings
- Toast Standard API gives "credentials with read-only access," and excludes "Write access" and "Sandbox access." Requests are per location. [Toast standard API overview](https://doc.toasttab.com/doc/devguide/devApiAccessUserGuide.html) [page]
- Requirements: "You must be an active employee of that Toast location," an active Restaurant Management Suite Essentials or higher subscription, and the Manage Integrations permission. [Toast requirements](https://doc.toasttab.com/doc/devguide/devApiAccessRequirements.html) [page]
- For US customers it is included in Restaurant Management Essentials. The page lists no dollar amount and says nothing on vendor use of the credentials. [Toast support](https://support.toasttab.com/en/article/Standard-API-Access) [page]
- Toast partner path: application and vetting, discovery, partner agreement, development with sandbox credentials, one-hour certification, alpha at one restaurant for about a week, beta at three to five locations for several weeks, then general availability. Compliance, privacy, security and legal approval come before development, and Toast says it "is not able to integrate with all interested integration partners." [Toast partnership process](https://doc.toasttab.com/doc/devguide/integrationDevProcess.html) [page]
- Toast publishes no review time, saying only that it "can take some time to hear back." [Toast partner article](https://intercom.help/toast-central/en/articles/11407925-become-a-toast-integration-partner) [page]
- Clover sandbox sign-up is self-serve, test merchants are "non-billable," and a sample inventory spreadsheet is offered. [Clover sandbox account](https://docs.clover.com/docs/create-a-sandbox-account) [page]
- Clover test tokens work "only for testing the API in the sandbox environment." Production uses expiring OAuth tokens. [Clover test token](https://docs.clover.com/docs/generate-a-test-api-token) [page]
- Clover production means account approval, app submission, payment flow videos and an email to developer relations. No time or fee is stated. [Clover approval](https://docs.clover.com/docs/approval) [page]. Forum posts describe waits of weeks, some from 2021 or earlier. [Clover community](https://community.clover.com/answers/34006/view.html) [snippet, anecdotal]
- Modisoft: a GetApp FAQ says Modisoft has no API available. [GetApp](https://www.getapp.com/all-software/a/modisoft) [snippet; a third-party directory, and the page refused the fetch]
- NRS: the home page menu lists a "Tobacco API" page with no details, names Uber Eats, Grubhub, DoorDash and eWIC integrations, and says "Export reports in Excel/CSV." No developer portal appeared. [NRS](https://www.nrsplus.com/) [page]

### Inferences
- "Is there any public API?" Best answer: none found for either, which is not proof that none exists. NRS's "Tobacco API" name suggests a manufacturer data feed, not a general API. I did not open it.
- Toast's employee requirement means an owner handing credentials to an outside helper is a gray area. Ask Toast before any live use.
- Stores with no POS have paper invoices, a phone line, a Z-tape and the owner's voice. All four fit an approve-first system without any connector, though no source tested Z-tape photos.

### Gaps
- Toast's terms page and FAQ refused the fetch, so Toast's contract terms on third-party access are unread.
- Clover developer terms were not read. Whether a Clover sandbox has webhooks without an App Market listing was not checked.
- I found no count of how many corner stores use NRS or Modisoft in this run.

## Google Business Profile API: reading reviews, posting replies, and Google's terms on models

### Takeaway
The Business Profile API rules differ from the Places rules. The Maps Platform terms expressly bar using Google Maps Content to improve models and bar creating content from it. The Business Profile policies do not mention AI or models at all, and they let an authorized tool reply when the owner has given specific consent. So a rule of reading Google Places reviews with no model stays correct for Places, but it does not automatically apply to the owner's own reviews. That reading is mine and is unsettled, so get Google's answer in writing before relying on it.

### Cited findings
Access:
- Requires a verified profile active at least 60 days, a website on the profile, and an owner or manager email; then a form choosing "Application for Basic API Access." [Prerequisites](https://developers.google.com/my-business/content/prereqs) [page]
- "If your quota is 0 QPM (Queries Per Minute), your project has not yet been approved." 300 QPM means approved. No review time is stated. [Prerequisites](https://developers.google.com/my-business/content/prereqs) [page]
- Read with `accounts.locations.reviews.list` or `batchGetReviews`. Reply with `PUT .../reviews/{reviewId}/reply`. [Review data](https://developers.google.com/my-business/content/review-data) [page]

Business Profile APIs policies, last updated 2026-08-28 [Policies](https://developers.google.com/my-business/content/policies) [verbatim]:
- "You can only use the Business Profile APIs to create, manage, and report on business listings that you either own or are authorized to manage on behalf of the business owner, or to develop tools for end-clients to similarly manage their listings."
- "If you respond to reviews on behalf of your end-client, you must receive their authorization first. All responses to reviews must follow Google's Prohibited and restricted content policies."
- "you must not automate or trigger review replies, Q&As, listing creations, listing edits, or other actions without the user's prior specific and express consent."
- "You cannot pre-fetch, cache, index, or store any content provided through the Business Profile APIs ("Content") for use outside of your Business Profile project except for limited amounts of Content." Stored Content "must be stored temporarily for no more than 30 calendar days" and "cannot be manipulated or aggregated in any way."
- "End users of your Business Profile APIs need to manually sign in to use it."
- Notice to the end-client within 48 hours of an account change; a demo account within seven days of Google's request; seven business days to disconnect a departing client.
- A text search of that page for "machine learning" and "artificial" found nothing in the policy text. A search of the [Google APIs Terms of Service](https://developers.google.com/terms) (last modified November 9, 2021) for the same terms also found nothing. [verbatim search]

Maps Platform terms, last modified August 26, 2026 [Maps Platform terms](https://cloud.google.com/maps-platform/terms) [verbatim], section 3.2.3:
- (a) "Customer will not export, extract, or otherwise scrape Google Maps Content for use outside the Services," with examples "(iii) copy and save business names, addresses, or user reviews; or (iv) use Google Maps Content with text-to-speech services."
- (b) "Customer will not cache Google Maps Content except as expressly permitted under the Maps Service Specific Terms."
- (c) "Customer will not create content based on Google Maps Content," with example "(vii) use Google Maps Content to improve machine learning and artificial intelligence models, including to train, test, validate or fine-tune the models."
- A text search of the Maps terms for "Business Profile" found no hit. [verbatim search]

### Inferences
- Places: the literal AI example bars improving models. Passing a review to a model for a summary is not named, but it fits "create content based on Google Maps Content," and saving reviews is barred separately. A rule of reading Places reviews with no model is a sound conservative reading.
- Places also has a trap: the text-to-speech example means read-aloud should not read Places reviews.
- Business Profile: an agent that drafts a reply, with the owner tapping Approve, fits "manage" and "prior specific and express consent." Unsettled points: whether sending a review to Anthropic is "use outside of your Business Profile project," whether a stored review in an event log passes the 30-day limit, and whether a weekly rating roll-up in an owner summary counts as "aggregated."
- A safe design: fetch reviews live, keep them no more than 30 days, compute any roll-up on the fly without storing it, and never train on them.
- Text an owner copies by hand is not API Content, but Google's other terms on that were not read. Label it as owner-supplied.
- Each shop needs a real, 60-day-old profile, and Google may require clients to sign in manually, so this cannot be faked in a test. A test version is a pasted review, labeled.

### Gaps
- Review time for API access is not published on the pages I read.
- Google's "Prohibited and restricted content" policy and Business Profile third-party policies were not opened.
- Anthropic's retention on API inputs was not checked against the 30-day limit.

## Delivery apps: DoorDash, Uber Eats, Grubhub

### Takeaway
A small shop cannot get a direct API. All three gate access behind partner approval. The realistic paths are merchant portal CSV exports, and later a middleware vendor or DoorDash's opt-in reporting API.

### Cited findings
- DoorDash Marketplace APIs are "not yet generally available." Applications are reviewed quarterly and stay at "Pending Activation" until then. [DoorDash requesting access](https://developer.doordash.com/docs/marketplace/overview/getting_started/requesting_access) [page]
- DoorDash launches only integrations meeting its standards, has a 14-day partner onboarding service level, a 2-hour live certification session, and a merchant cancel rate limit below 1%. [DoorDash integration requirements](https://developer.doordash.com/en-US/docs/marketplace/overview/getting_started/general_integration_requirements) [snippet]
- DoorDash Reporting API is opt-in. Direct use needs an interest form reviewed by an access team; reports come as CSV; partners are Itsacheckmate and Nextbite. It also lists Merchant Portal, S3 and Sigma as alternatives. [DoorDash help](https://help.doordash.com/en-ca/merchants/article/how-can-i-access-the-doordash-reporting-api) [page]
- Uber Eats access needs a developer account, an NDA, an API license, partner approval ("Speak with your Uber Eats partner manager") and possibly written approval from Uber. Testing uses "simulated stores and orders." [Uber Eats getting started](https://developer.uber.com/docs/eats/guides/getting-started) [page]
- Grubhub issues a partner key when you enter the POS integration program. Work runs through preproduction credentials and a test store. [Grubhub authentication](https://grubhub-developers.zendesk.com/hc/en-us/articles/360000061003-Authentication) [snippet]; [Grubhub milestones](https://grubhub-developers.zendesk.com/hc/en-us/articles/10855385187092-Development-and-Milestones) [snippet]
- Middleware vendors such as Deliverect, Otter, Chowly and Checkmate hold partner access. [Parseur](https://parseur.com/use-case/grubhub-api-integration) [snippet, vendor]

### Inferences
- For a test without partner approval, the only likely input is a labeled fake CSV in the shape of a portal export.
- A delivery event could be real later through a shop's middleware account, but that adds a monthly bill the owner may not have.
- HB 895 covers third-party food delivery providers, not the shop, so it is not a reason to avoid this data. See the corner store section.

### Gaps
- Merchant agreements on what a shop may do with customer data from these apps were not read. Assume the customer's data belongs to the app until checked.
- Whether each portal offers self-serve CSV was only confirmed in passing for DoorDash.

## Invoice capture from a phone photo

### Takeaway
This is a real input that needs no integration and can be tested. Evidence on accuracy is thin and mostly from vendors. I found no study of Claude on handwritten or thermal distributor invoices. Treat every field as a draft the owner confirms, and have code check the arithmetic.

### Cited findings
- Anthropic's docs: "Claude might hallucinate or make mistakes when interpreting low-quality, rotated, or very small images under 200 pixels," and "Do not use Claude for tasks requiring perfect precision or sensitive image analysis without human oversight." A 1000x1000 image costs about $1.30 per thousand at Haiku 4.5's rate. [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision) [verbatim]
- One vendor beta, about 4,800 invoices from about 200 users over six months, scored on seven fields: 95 to 97% at 300+ DPI, 91 to 94% at 150 to 300 DPI, 85 to 92% for smartphone photos ("highly variable"), and "Accuracy drops to 60-80%" for handwritten corrections. The handwriting figure has no stated sample or method, and the vendor sells this software. [Invoox](https://invoox.io/en/blog/ai-vision-invoice-extraction-accuracy/) [page, vendor]
- AIMultiple's handwriting benchmark: 100 cursive samples from 10 writers, including Claude Sonnet 4.5, with Gemini 3 Pro Preview scoring perfect and DeepSeek OCR 79%. The fetch tool found no score for Claude. Updated August 25, 2026. This is paragraph handwriting, not invoices. [AIMultiple handwriting](https://aimultiple.com/handwriting-recognition) [page]
- AIMultiple also warns that vision-model OCR can invent text that is not on the page, which is harder to spot than a misread. [AIMultiple OCR](https://aimultiple.com/invoice-ocr) [page]
- GPT-4V on mostly printed invoices: 98.1% invoice number, 99.0% date, 88.7% line items, no handwriting results. [DataUnchain](https://dataunchain.com/en/llm-document-extraction-benchmark/) [snippet, vendor]
- Scanned receipts (SROIE): Gemini 2.5 Pro reached 87.46% using the image directly, against 47.00% for the best text-parsed approach. Claude was not tested. [Lacuna](https://lacuna.tiptreesystems.com/work/multi-modal-vision-vs-text-based-parsing-benchmarking-llm-strategies-for-invoice/wrk_834268b05a3672da0cb70dac11291a84) [snippet]
- A small project reports 99.3% field accuracy on 51 invoices for Llama 4 Scout, but Claude produced the ground truth, so it says little. [GitHub](https://github.com/GyanendraChaubey/invoice-extraction-vlm-vs-ocr) [snippet]
- An arXiv paper on invoice extraction notes older OCR "significantly declined" on handwritten and low-resolution documents; I found no Claude results in a text search. [arXiv 2511.05547](https://arxiv.org/pdf/2511.05547) [verbatim search]

### Inferences
- Line items are the weak field even on printed invoices, and they are the field a price-rise alert depends on. Arithmetic checks in code (quantity times price equals line, lines sum to total) catch some errors without the model. A failed check should stop the task and ask the owner.
- An invoice photo is untrusted input. It should pass the same Zod schema check and planted-text handling as a vendor page.
- Best evidence is your own: shoot 10 real invoices, including one handwritten and one faded thermal, and report field accuracy honestly. That is also stronger than a borrowed number.

### Gaps
- No evidence found on thermal paper or on distributor invoices specifically.
- Competitor practice is unverified: the MarginEdge page I tried was a 404, so whether restaurant invoice tools use human review was not confirmed.

## Missed-call capture with Twilio

### Takeaway
The event is easy and cheap: answer on a Twilio number, try the shop's phone, and treat no answer as the event. Voice does not need A2P registration, but the text-back does, and text-back has the consent question covered in the TCPA section.

### Cited findings
- Twilio posts `DialCallStatus` to the `<Dial>` `action` URL, and the tutorial branches on busy, no-answer, canceled and failed. [Twilio tutorial](https://www.twilio.com/en-us/blog/developers/tutorials/no-answer-pickup-scenarios-with-voicemail-and-callack-using-twilio-voice) [page]. Twilio's help article shows a Flask version of the same branch. [Twilio support](https://support.twilio.com/hc/en-us/articles/15274106349723-How-to-Handle-No-Answer-and-Busy-Status-With-a-Python-Flask-Server-When-Call-Forwarding) [snippet]
- The changelog adds `DialBridged`, true only when the child call was really connected, which is a more reliable signal than status alone. [Twilio changelog](https://jp.twilio.com/docs/voice/twiml/changelog) [snippet]
- A public template uses a two-hour window so a repeat caller gets only one text. [n8n](https://n8n.io/workflows/17512-text-back-missed-calls-and-notify-business-owners-with-twilio-and-telegram/) [snippet]
- Price: local number $1.15 per month, inbound $0.0085 per minute, outbound $0.014 per minute. [Twilio voice pricing](https://www.twilio.com/en-us/voice/pricing/us) [page]

### Inferences
- A test: someone calls the Twilio number, nobody answers, and a "Missed call from..." task appears. Approving then sends the text, or shows it on a labeled simulated phone if Twilio blocks it.
- Later, a shop keeps its number and sets carrier forwarding on no answer, or it publishes the Twilio number. No recording is needed, which avoids the Maryland wiretap issue entirely.

### Gaps
- Trial account limits on inbound voice were not confirmed. Twilio's page says "Verified recipients" for sends and points to a separate restrictions page I did not open.
- Carrier forwarding codes and any landline limits were not checked.

## Staff group chats: WhatsApp, GroupMe, iMessage, SMS

### Takeaway
You cannot read an existing staff WhatsApp, iMessage or SMS group through any official route I found. A business can create its own small WhatsApp or Twilio group, and GroupMe does expose group messages, but those mean moving staff onto something new with their knowledge. A mock group chat is the right call for testing.

### Cited findings
- WhatsApp Cloud API groups: need an Official Business Account, are "not available" for WhatsApp Business app numbers, cap at 8 participants, 10,000 groups per number, one Cloud API business per group, join by invite link. "Receive group messages" is a listed feature. [WhatsApp groups docs](https://developers.facebook.com/docs/whatsapp/cloud-api/groups) [page]
- WhatsApp terms section 4.7, last modified September 23, 2026: AI Providers are barred where AI is the "primary (rather than incidental or ancillary) functionality," with Meta deciding in its sole discretion. You may retain an AI Provider as a Solution Provider but may not let Platform Data, including anonymous or derived forms, be used to "create, develop, train, or improve" AI models. You may fine-tune a model for your exclusive use. [Meta terms for WhatsApp Business Platform](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform) [page]
- Support, sales and notification bots remain allowed; the ban targets general-purpose assistants. [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban) [snippet, vendor]; [TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/?rand=324) [snippet]
- GroupMe: `GET /groups/:group_id/messages` reads a group with a user's token, up to 100 per call, and using the API means accepting its terms. [GroupMe API](https://dev.groupme.com/docs/v3) [page]. A bot's callback gets "an HTTP POST request from us every time a message is published to that group." [GroupMe bots](https://dev.groupme.com/tutorials/bots) [page]
- Twilio Group MMS: "a limit of 10 total Participants," +1 numbers only, no toll-free or short codes, and only new conversations through Twilio's number. Reading threads already on people's phones is not described. [Twilio group texting](https://www.twilio.com/docs/conversations/group-texting) [page]

### Inferences
- For WhatsApp, a shop's agent that drafts tasks from staff messages looks like "incidental" AI, but Meta decides, so it is not a safe assumption for a platform built around agents.
- GroupMe is the only chat here with a usable read path, and staff should be told the bot is in the group. Reading a chat without telling staff also raises the consent problem in the recording section, and possibly labor-law issues, neither of which I confirmed for chats.
- An honest claim: staff text one shop number, or the owner pastes messages. Do not claim to read their existing chat.

### Gaps
- iMessage: I found no public API, but the Apple page I tried did not cover it, so "none" is my understanding, not a confirmed fact.
- GroupMe's terms page returned a 404, so limits on reading others' messages are unread.
- WhatsApp's own chat export as an owner-supplied file was not checked.
- NLRA rules on employer monitoring of staff chats were not researched in this run.

## TCPA, FCC rules and A2P 10DLC for texting customers

### Takeaway
A human tap on Approve helps on the federal autodialer question but does little else. Under Facebook v. Duguid, a system texting a known list is already unlikely to be an autodialer, tap or no tap. The tap does not touch do-not-call rules, AI voice rules, Maryland's broader "automated system" wording, or Twilio's own consent rules. Missed-call text-back has no case I could find directly on point. Twilio's trial, as documented today, may also block a test that sends custom text to verified phones.

### Cited findings
Federal rules:
- Autodialer: a device must have capacity "to store a telephone number using a random or sequential number generator, or to produce a telephone number using a random or sequential number generator." Decided April 1, 2021. [Facebook v. Duguid](https://www.law.cornell.edu/supremecourt/text/19-511) [page]
- Marketing by autodialer or prerecorded voice needs prior express written consent, defined as a signed agreement. Telemarketing means a message "for the purpose of encouraging the purchase." [47 CFR 64.1200](https://www.law.cornell.edu/cfr/text/47/64.1200) [page]
- Consent can be revoked "by using any reasonable method," honored within "a reasonable time not to exceed ten business days," and one confirmation text with no marketing is allowed. [47 CFR 64.1200](https://www.law.cornell.edu/cfr/text/47/64.1200) [page]
- Solicitation limits: 8 a.m. to 9 p.m., national do-not-call registry, internal do-not-call list, extended to wireless numbers and texts. [47 CFR 64.1200](https://www.law.cornell.edu/cfr/text/47/64.1200) [page]
- That page links an amendment at 91 FR 67219 dated Oct. 26, 2026. I could not open it. [47 CFR 64.1200](https://www.law.cornell.edu/cfr/text/47/64.1200) [page]
- The revoke-all part was delayed to January 31, 2027 by a bureau order of January 6, 2026. Other revocation duties stay in force. [Burr](https://www.burr.com/telephone-consumer-protection-act/the-fcc-delays-effective-date-of-tcpa-revoke-all-rule-until-january-31-2027) [snippet, analysis]; [Orrick](https://infobytes.orrick.com/2026-01-16/fcc-extends-robocall-consent-revocation-rule-waiver-to-january-2027/) [snippet, analysis]
- The one-to-one consent rule was vacated by the Eleventh Circuit and later removed. [Mondaq](https://www.mondaq.com/unitedstates/telecoms-mobile-cable-communications/1679726/the-fcc-issues-final-rule-formally-eliminating-the-one-to-one-consent-requirement) [snippet, analysis]

AI voices, FCC 24-17, adopted February 2 and released February 8, 2024 [FCC ruling](https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf) [verbatim]:
- "we confirm that the TCPA's restrictions on the use of "artificial or prerecorded voice" encompass current AI technologies that resemble human voices and/or generate call content using a prerecorded voice."
- "callers that use such technologies must obtain the prior express consent of the called party to initiate such calls absent an emergency purpose or exemption."
- Ads also require specified opt-out methods, and the requirements apply "to any AI technology that initiates any outbound telephone" call.

Human tap and autodialer:
- Pascal v. Concentra (N.D. Cal., per a December 2021 article): a platform where people upload lists, draft, schedule and activate sends showed "all of the hallmarks of human intervention" and was not an autodialer. It predates most later law. [Troutman](https://www.troutman.com/insights/human-intervention-still-answers-the-call-northern-district-of-california-curtails-text-based-tcpa-class-action/) [page, analysis]
- A compliance blog says human intervention still matters if consent is missing or disputed. [LeadCompliant](https://leadcompliant.com/articles/penalties-and-lawsuits/how-courts-define-human-intervention-in-dialing-tcpa-cases) [snippet, low authority]

Texts and the do-not-call private claim, unsettled:
- Steidinger v. Blackstone Medical Services (7th Cir. July 14, 2026): "[r]epeated, unwanted text messages . . . do not fall within the private right of action created by § 227(c)(5)." Foley reports it does not affect the autodialer and prerecorded provisions or state laws, and contrasts Howard v. RNC (9th Cir. 2026), holding a text is a "call" under § 227(b)(1). [Foley](https://www.foley.com/insights/publications/2026/08/the-seventh-circuit-to-issue-first-appellate-decision-holding-that-text-messages-are-not-covered-by-do-not-call-provisions-of-the-tcpa/) [page, analysis, opinion itself not read]
- By one count, about 18 post-McLaughlin district decisions treat texts as calls under § 227(c)(5), about 11 go the other way, and the article does not mention the Fourth Circuit or Maryland. [Fox Rothschild](https://www.foxrothschild.com/publications/courts-divided-over-whether-text-messages-are-telephone-calls-under-tcpa) [page, analysis]

Missed-call text-back, unsettled:
- Butera v. Sugarhouse (D. Utah June 30, 2025) dismissed a claim over a return call after a missed call: "It is common in this day and age for a person to return a 'missed call'." It concerns calls, not texts. [National Law Review](https://natlawreview.com/article/invitation-court-refuses-allow-litigators-manufacture-tcpa-claims-holds-company-can) [page, analysis]
- Troutman's critique there: neither the TCPA nor the rules have a missed-call exception, and a "sterile missed call" may not be an invitation, inquiry or transaction. [National Law Review](https://natlawreview.com/article/invitation-court-refuses-allow-litigators-manufacture-tcpa-claims-holds-company-can) [page, analysis]
- No law firm memo on text-back workflows turned up. [Search result set](https://tcpaworld.com/2025/07/01/invitation-court-refuses-to-allow-litigators-to-manufacture-tcpa-claims-holds-a-company-can-safely-return-a-missed-call-without-violating-the-tcpas-dnc-provisions/) [snippet]

Maryland Stop the Spam Calls Act, effective January 1, 2024:
- Without prior express written consent, a person may not make "a telephone solicitation that involves: (i) An automated system for the selection or dialing of telephone numbers; or (ii) The playing of a recorded message." [Md. Com. Law 14-4502](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4502) [verbatim]
- Exemptions include "A single telephone solicitation made to a customer or client in response to an inquiry or request from the customer or client," and informational messages to an existing customer that turn into a solicitation only after the customer's further inquiry. [Md. Com. Law 14-4502](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4502) [verbatim]
- No solicitation between 8 p.m. and 8 a.m., and no more than three in 24 hours on the same subject. This is stricter than the federal 9 p.m. end time. [Md. Com. Law 14-4502](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4502) [verbatim]
- Telephone solicitation is "an organized activity, program, or campaign to communicate by telephone with residents of Maryland in order to" sell. [Md. Pub. Util. 8-205](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gpu&section=8-205) [verbatim]. The written consent definition covers texts. [Md. Com. Law 14-4501](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4501) [page]
- Kelley Drye reads "automated system" as undefined and broader than the federal term, and reports civil penalties up to $10,000 per violation, $25,000 for repeats, criminal exposure and a private action under the Consumer Protection Act. [Kelley Drye](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/marylands-new-telemarketing-law-now-in-effect.md) [page, analysis]

A2P 10DLC and Twilio's own rules:
- Twilio "blocks messages to U.S. numbers" from a 10DLC number not tied to an approved campaign. [Twilio error 30034](https://www.twilio.com/docs/api/errors/30034) [page]. Twilio's overview only mentions "additional carrier fees" for unregistered senders. [Twilio A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc) [page]. These conflict, and the error page is more specific.
- Trial accounts: "You can only send to verified phone numbers (up to 5 per account)." "You must use Twilio-provided templates. Custom message bodies, email content, and WhatsApp templates aren't available during trial." Registration "must have a paid Twilio account." [Twilio trial guide](https://www.twilio.com/docs/messaging/guides/how-to-use-your-free-trial-account) [verbatim]
- Fees: $4.50 brand, $15 campaign vetting, non-refundable, $2 per month sole proprietor campaign, $1.50 to $10 per month for others, $41.50 secondary vetting for Standard brands. [Twilio pricing article](https://support.twilio.com/hc/en-us/articles/1260803965530) [snippet, the page refused the fetch]
- Limits: Sole Proprietor is one campaign and about 3,000 segments per day across carriers. Low Volume Standard is up to five campaigns and about 6,000. A Tax ID on more than five brands can trigger rejection. [Twilio A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc) [page]
- Message cost: $0.0083 per segment plus $0.0035 to $0.005 outbound carrier fee; number $1.15 per month. [Twilio SMS pricing](https://www.twilio.com/en-us/sms/pricing/us) [page]
- Twilio policy, independent of the TCPA: informational messages need "prior express consent," promotional need "prior express written consent," and the first message must include "Reply STOP to unsubscribe" or an equivalent. [Twilio messaging policy](https://www.twilio.com/en-us/legal/messaging-policy) [page]

### Inferences
- Answer to "does the tap change the analysis?": Federally, a system texting a shop's own customers from a known list likely is not an autodialer under Duguid, with or without the tap. The tap adds a helpful fact, especially for Maryland's undefined "automated system," where the agent may still count as selecting the number. No court I found has ruled on an LLM-drafted, human-approved text, so this is unsettled. The tap does not supply consent.
- Marketing versus transactional: a mix of order-ready and "come back for 20% off" on one number needs two consent levels. An approve-first system should tag each outgoing text as informational or promotional, and block promotional sends lacking a written consent record.
- Text-back safest form: one text, no offer, business name, STOP language, inside 8 a.m. to 8 p.m. local, no repeat within a set window, and no follow-up marketing unless the customer replies and consents. Maryland's single-reply exemption may help if a missed call counts as an "inquiry," which is unsettled. A hang-up does not clearly fit.
- Steidinger limits private do-not-call suits over texts in the Seventh Circuit only. Maryland sits in the Fourth Circuit, and I found nothing from it, and FCC and Maryland enforcement are separate. Do not build on it.
- AI voice: outbound AI callback needs prior express consent, and written consent if it sells. The ruling speaks to calls that AI initiates, so it does not clearly reach AI answering an inbound call, but recording law does. See the next section.
- Testing: the trial's template-only rule would break any plan of verifying a few phones and sending custom text from the trial. Test it first. If blocked, either pay and register now and expect delay, or show a labeled simulated phone that says on screen it is simulated.

### Gaps
- Review time for A2P 10DLC: not confirmed. Twilio's vetting FAQ refused the fetch. One snippet confirms vetting is manual but gives no duration. One unverified note says review takes "longer than a weekend," which is unverified but plausible. [secondary, source not reopened]
- The 91 FR 67219 amendment (Oct. 26, 2026) could not be read. Someone should check whether it changes 64.1200 before relying on the rule text above.
- How a platform registers many shops (one brand each, or an ISV model) was not researched. It decides the real long-run cost.
- Whether Twilio accepts a missed call as the opt-in on a campaign form is unknown.
- McLaughlin itself was not opened. It is cited only through Foley.

## Maryland call recording and AI phone answering

### Takeaway
Maryland requires all parties' prior consent, and a violation is a felony with a private claim. An AI that listens to a live call should announce itself and the recording before doing anything. For a first version, avoid the problem by not recording or transcribing calls.

### Cited findings
- It is lawful to intercept "where all of the parties to the communication have given prior consent," otherwise unlawful, and a violation "is guilty of a felony" with up to 5 years or a fine up to $10,000 or both. [Md. Cts. & Jud. Proc. 10-402](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=10-402) [page]
- Civil claim: actual damages but not less than $100 a day or $1,000, whichever is higher, plus punitive damages and attorney's fees. [Md. Cts. & Jud. Proc. 10-410](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=10-410) [page]
- Taylor v. ConverseNow (N.D. Cal. Aug. 11, 2025), a pleading-stage ruling under California's law: a Domino's customer routed to an AI phone assistant without notice. The court treated the vendor as a third party because it "has the capability to use caller communications" to improve its products, and refused dismissal. No finding of actual violation. [Privacy World](https://www.privacyworld.blog/2025/12/extra-large-pii-zza-courts-allows-california-privacy-class-action-to-proceed-for-use-of-ai-phone-call-assistant/) [page, analysis]
- California law is not uniform here: Gutierrez v. Converse (9th Cir.) held that a vendor's capability to access a communication is not enough under one clause of Section 631(a). [Search summary of commentary](https://www.fisherphillips.com/en/insights/insights/federal-appeals-court-hands-out-win-in-website-chat-wiretap-case) [snippet, analysis]

### Inferences
- ConverseNow is California, but it is the closest fact pattern: restaurant, phone, AI vendor, no notice. A Maryland plaintiff would likely try the same theory, and Maryland's all-party rule is a good fit. Unsettled.
- Practical rule: the first words on any AI-handled call say it is an automated assistant and is recorded, and the caller continues only if they agree. A contract and a setting that bar vendor training on calls help on the "capability" theory, though they do not remove it.
- Missed-call text-back without recording stays outside this law as far as the event goes. Caller ID and call status are not call content, by my reading, not a cited holding.

### Gaps
- No Maryland decision on AI call answering or on real-time transcription as interception was found.
- Whether a voicemail greeting gives adequate consent in Maryland was not checked.
- Multi-state callers were not researched. Assume the strictest rule.

## Food allergy risk

### Takeaway
An AI should not answer allergen questions, and an approved draft does not fix that, since the tap turns a model's guess into the restaurant's statement. Duties sit with the restaurant, and written notice and trained staff are the expected routes. I found no reported incident or case about an AI allergen answer, which is a gap and not evidence of safety.

### Cited findings
- FDA: the Food Code is "neither federal law nor federal regulation." Where adopted, section 3-602.12 requires written notice of major allergens in unpackaged food, section 3-602.11 covers packaged and bulk foods, and sections 2-102.11 and 2-103.11 say training "must include food allergy awareness of the 9 major food allergens." [FDA](https://www.fda.gov/food/retail-food-industryregulatory-assistance-training/addition-2022-food-code-sesame-added-major-food-allergen) [page]
- Written notice can be on menus, placards, table tents or electronic boards. Packaged-food labeling applies regardless of Food Code adoption. [Perkins Coie](https://perkinscoie.com/en/news-insights/on-the-menu-food-allergen-disclosures-for-restaurants-and-food-service.html) [snippet, analysis]
- Maryland: "a food establishment shall display prominently in the staff area" a poster on allergy awareness. [Md. Health-Gen. 21-330.2](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=ghg&section=21-330.2) [page]; [COMAR 10.15.03.32](https://dsd.maryland.gov/regulations/Pages/10.15.03.32.aspx) [snippet]
- Purdue (Journal of Food Protection, Sept 2026): ChatGPT-3.5, Bard, Meta AI and Copilot agreed with specialists on 40 to 80% of 20 food practices. Rewording a question could change the risk answer, and citations were often invalid. Older models, and food safety rather than allergens. [Purdue](https://ag.purdue.edu/news/2026/09/purdue-food-scientists-encourage-caution-about-ai-chatbot-advice.html) [page]
- A 2023 meal-planning test: a forbidden allergen appeared in 4 of 56 cases, with an old model. [Fox News](https://www.foxnews.com/health/chatgpt-meal-planning-food-allergies-study-measured-robo-diet-safety-experts-warnings) [snippet]
- ChatGPT's food allergy answers largely matched guidelines, but only 39% of 41 cited sources were accurate. [Annals of Allergy](https://www.annallergy.org/article/S1081-1206(23)00647-6/fulltext) [snippet, page refused]
- A restaurant guide says a chatbot should only repeat the checked menu and never judge safety for a person. [Deskwoot](https://deskwoot.com/blog/ki-in-der-gastronomie) [snippet, vendor, German context]

### Inferences
- A model cannot know about cross-contact, a substitute ingredient, or what the cook did today, and neither can the menu. So a correct-looking answer can still be wrong in the kitchen.
- Design: any customer message or call mentioning an allergy becomes a task with no draft reply: "Allergy question from Ana. Call her, or answer yourself." The plain code that carries out actions refuses any outgoing text on that thread until the owner writes it in their own words. Detection should be keyword code plus model, and it should fail toward flagging.
- An allowed use: helping the owner build a written allergen sheet from their own recipes, with owner sign-off and a "ask staff" line. That serves the written-notice duty and answers no customer directly.

### Gaps
- Which Food Code edition Maryland has adopted, and whether written notice applies there today, was not confirmed. Local health departments may add rules.
- No case law on AI allergen answers found. Restaurant negligence precedent and Moffatt v. Air Canada (chatbot statements) were not opened, and the ABA page refused the fetch.

## Labor: schedules and tips an agent could break

### Takeaway
Maryland has no predictive scheduling law in any list I saw, but schedule drafts can still break minors' hour limits, overtime rules, and tip rules. These are exact rules, so code should enforce them, with the model only drafting. Rules vary by county.

### Cited findings
- Tip credit: an employee must regularly get more than $30 a month in tips and "has been informed by the employer," pooling is not barred, and the credit "may not exceed the minimum wage... less $3.63." [Md. Lab. & Empl. 3-419](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=3-419) [verbatim]
- State minimum $15.00 and maximum tip credit $11.37. [7shifts](https://www.7shifts.com/blog/maryland-tip-laws/) [snippet, vendor]. Check against the state. The state FAQ below still uses an older $11 example.
- Restaurants must give a wage statement showing the effective hourly tip rate each workweek, within two weeks after the pay period, and keep it three years. If cash plus tips fall short of minimum for the workweek, the employer makes up the difference. Overtime is 1.5 times the minimum wage less the tip credit. A $4.00 Montgomery County figure appears. [Maryland Labor FAQ](https://labor.maryland.gov/labor/wages/esstipcreditfaqs.shtml) [page, dated examples]
- Federal: employers may not keep tips, and managers and supervisors may not receive tips from a pool. A pool including cooks and dishwashers is allowed only when no tip credit is taken. Five items of notice are required before taking a tip credit. Owners with a 20% stake active in management count as managers. [DOL Fact Sheet 15](https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa) [page]
- Overtime: "at least 1.5 times the usual hourly wage," and the exemption list does not name restaurants. [Md. Lab. & Empl. 3-415](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=3-415) [page]
- Under 16: no work before 7 a.m., or after 8 p.m. (9 p.m. from Memorial Day to Labor Day), 4 hours on a school day, 8 on a non-school day, 23 hours in a school week, 40 otherwise. [Md. Lab. & Empl. 3-211](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=3-211) [page]
- Retail breaks: a 15-minute break for 4 to 6 consecutive hours and 30 minutes beyond 6, but only for employers with 50 or more retail employees, and "a restaurant" is excluded. [Md. Lab. & Empl. 3-710](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=3-710) [verbatim]
- Predictive scheduling: Oregon statewide plus cities such as New York, San Francisco, Seattle, Philadelphia, Chicago and Los Angeles. Counts differ by source, and none of these lists named Maryland. [Homebase](https://joinhomebase.com/blog/predictive-scheduling-laws/) [snippet, vendor]; [Paycor](https://www.paycor.com/resource-center/articles/predictive-work-schedule-laws-a-city-by-city-guide/) [snippet, vendor]

### Inferences
- Ways a draft breaks the law: a 15-year-old closing past 8 p.m., hours above 23 in a school week, a shift pushing someone past 40 with no overtime flagged, kitchen staff in a pool while servers get the tip credit, a manager or owner-manager in a pool, or a tip split with no notice.
- Code should hold a typed rule set and hard-fail any draft violating it: no birth date, no minor schedule. The model explains the fix. Tip math should stay outside the agent's actions entirely.
- Corner stores with few staff usually fall outside the break law, but the minors rules apply to them.

### Gaps
- Rules for ages 16 and 17 were not found. The section I opened, 3-212, is about transporting money, not hours.
- Maryland's sick and safe leave rule, meal break rules for minors, reporting pay, and current county wages were not confirmed.
- "No Maryland law" rests on vendor lists not naming it. No Maryland source states it directly.

## Corner store limits: SNAP, tobacco, lottery, pricing and promotions

### Takeaway
Tobacco and vape customer texts are out, not because of Maryland law but because the carriers' rules ban them "regardless of local legality." Lottery prices are fixed by law. SNAP bars singling out SNAP customers. Maryland's new pricing law reaches stores of 15,000 square feet and up, so it leaves corner stores out, but the agent should still not use personal data to set prices.

### Cited findings
SNAP:
- "Coupons shall be accepted for eligible foods at the same prices and on the same terms and conditions applicable to cash purchases." "No retail food store may single out coupon users for special treatment in any way." [7 CFR 278.2](https://www.law.cornell.edu/cfr/text/7/278.2) [page]
- Stocking: seven varieties in each of four staple categories, three units of each, and one perishable variety in three categories. [7 CFR 278.1](https://www.law.cornell.edu/cfr/text/7/278.1) [page]
- Penalties: permanent disqualification for trafficking, with a civil penalty possible instead, and disqualification from 6 months to permanent for selling ineligible items, by severity. [7 CFR 278.6](https://www.law.cornell.edu/cfr/text/7/278.6) [page]

Tobacco and vape:
- CTIA "prohibits A2P messaging campaigns that promote the sale, marketing, or distribution of tobacco products," covering "all tobacco and nicotine delivery products regardless of local legality," and the rejected campaign is "not eligible for resubmission." [Twilio error 30958](https://www.twilio.com/docs/api/errors/30958) [page]
- Twilio states tobacco, vape and e-cigarettes are not allowed on toll-free, short code or long code "regardless of age gating." [Twilio error 30878](https://www.twilio.com/docs/api/errors/30878) [snippet]
- Federal: ID check under 30 for cigarettes and smokeless, sale "only in a direct, face-to-face exchange," no selling covered products with electronic devices outside adult-only places. [21 CFR 1140.14](https://www.law.cornell.edu/cfr/text/21/1140.14) [page]
- No free cigarette samples. [21 CFR 1140.16](https://www.law.cornell.edu/cfr/text/21/1140.16) [page]. No gift or item offered with a purchase of cigarettes or smokeless, including through coupons or proof of purchase. [21 CFR 1140.34](https://www.law.cornell.edu/cfr/text/21/1140.34) [page]
- Maryland: distributing tobacco, paraphernalia or tobacco-redeemable coupons to under-21s is a misdemeanor with fines of $500 to $3,000 and possible license action. [Md. Crim. Law 10-107](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcr&section=10-107) [page]

Alcohol, conflict in sources:
- Twilio's forbidden list includes alcohol under SHAFT. [Twilio forbidden categories](https://support.twilio.com/hc/en-us/articles/360045004974-Forbidden-Message-Categories-for-SMS-and-MMS-in-the-US-and-Canada) [snippet]
- Third-party guides say age-gated alcohol is allowed. [MessageDesk](https://docs.messagedesk.com/messaging/restrictions) [snippet]; [Telnyx](https://support.telnyx.com/en/articles/14286763) [snippet]

Lottery:
- A person may not, unless a licensed agent or employee, sell tickets, and may not sell or buy "a State lottery ticket or share at any price other than the price that the regulations of the Agency set," or "sell a State lottery ticket or share to a minor." [Md. State Gov't 9-124](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsg&section=9-124) [page]

Automated pricing and promotions:
- Maryland's Protection From Predatory Pricing Act (HB 895), signed April 28, effective October 1, 2026, covers "food retailers" with "a substantial grocery or market business of at least 15,000 square feet" and third-party food delivery providers. It excludes food for immediate or on-premises consumption, bars setting personalized prices from personal data, and exempts promotions, loyalty benefits, temporary discounts, programs open to all and cost-based differences. Attorney General only, with a 45-day cure. [Troutman](https://www.troutmanprivacy.com/2026/04/maryland-enacts-protection-from-predatory-pricing-act/) [page, analysis]
- A search summary of the coverage says shelf prices must hold for one business day. Troutman's summary does not list that, so check the enrolled bill. [Hunton, one of the sources in that result set](https://www.hunton.com/privacy-and-cybersecurity-law-blog/maryland-enacts-first-of-its-kind-ban-on-surveillance-pricing-for-grocery-sales) [snippet, attribution uncertain]
- Maryland's below-cost sales subtitle defines "cost to the retailer" as invoice or replacement cost plus freight, cartage and markups of 5% and possibly 2%. [Md. Com. Law 11-401](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=11-401) [verbatim]. Exemptions include prices "set in good faith to meet competition" and motor fuel. [Md. Com. Law 11-402](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=11-402) [page]

### Inferences
- What must stay out of customer texts at a corner store: tobacco, vape, nicotine, and, until Twilio confirms otherwise, alcohol and lottery. A plain code denylist on outgoing texts can enforce this, and it should also cover images and the store's other numbers. A registered store selling tobacco can still text about milk, though the business type language in Twilio's list raises a question for a smoke shop. A vape shop is likely unservable by SMS.
- SNAP: no "SNAP customers" segment, no discount or surcharge keyed to EBT, no messages picking out EBT users. Sale-of-ineligible risks mean the agent should not suggest ringing items differently. Inventory rules can use the stocking counts as a check for a store's own compliance. That is a useful, low-risk task.
- Pricing: agents can suggest a store-wide price, but drafted tasks should cite cost, not a customer's data. Lottery and possibly cigarette prices must be excluded from any price suggestion. A price below the statutory cost needs a check, once the prohibition section is confirmed.
- Age-restricted sales are in-person ID duties. An agent has no part in them, and no drafted task should imply it verified an age.

### Gaps
- No search was run on: Maryland cigarette minimum pricing, Maryland vape licensing and flavor limits, county tobacco rules, Maryland alcohol price and promotion rules, Maryland Lottery agent advertising rules, or USDA's retailer handbook. fns.usda.gov refused the fetch, so I did not read its eligible-food list or stocking updates.
- Commercial Law subtitle 4: I read the definitions and exemptions, not the section that actually prohibits below-cost sales. Whether it treats cigarettes separately is unconfirmed.
- 7 CFR 278.1 on Cornell may lag the latest USDA rule.
- Whether SNAP treats opt-in promotions that happen to reach EBT users as special treatment is not answered.

## FTC fake review rule, AI review replies and state AI disclosure rules

### Takeaway
The FTC rule targets fake reviews, not a business's honest reply, and the FTC says "you can respond publicly." An AI-written reply is not itself a violation of it. The real risk comes from an agent that writes reviews, makes false claims about a reviewer, or ties incentives to good ratings. I could not verify state AI disclosure laws in this run, so disclose by default.

### Cited findings
- The rule bars fake or false reviews (465.2), incentives tied to sentiment (465.4), undisclosed insider reviews (465.5), company-controlled sites posing as independent (465.6), suppression (465.7), and fake social influence (465.8). "The rule authorizes courts to impose civil penalties for knowing violations." [FTC Q&A](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers) [page]
- Barred: writing, creating or selling a review that "materially misrepresents, expressly or by implication" the reviewer's existence, use or experience; and procuring misleading third-party reviews from staff or relatives. General requests to buyers are excepted. [16 CFR 465.2](https://www.law.cornell.edu/cfr/text/16/465.2) [page]
- Replying: "Yes, you can respond publicly to the review." But no false accusation about a reviewer known to be false or made with reckless disregard, and no intimidation. A business "shouldn't provide the text for a testimonial without a reasonable basis" for believing it is truthful. The page does not mention AI writing tools. [FTC Q&A](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers) [page]
- Rytr, an AI review writing case: complaint September 25, 2024, final order December 18, 2024, and on December 22, 2025 the FTC reopened and set aside the order, citing the AI Action Plan. [FTC Rytr page](https://www.ftc.gov/legal-library/browse/cases-proceedings/232-3052-rytr-llc-matter) [page]

### Inferences
- Allowed with care: an owner-approved reply that does not invent facts about the visit or the reviewer. Keep the reply grounded in what the owner confirms.
- Out: drafting a review for a customer or staff member to post, suggesting family post reviews without disclosure, offering a discount for 5 stars, or a drafted "reply" that accuses a reviewer of lying without owner evidence. A generic "tell us how it went" text is fine under 465.2(d), but it needs SMS consent too.
- The Rytr reversal lowers enforcement risk for tool makers, but the rule on the businesses using it stands.
- State disclosure: the safe default is to state on every automated customer touch that it is automated. ConverseNow's fact pattern turned partly on lack of notice, and a rule of labeling simulated content points the same way.

### Gaps
- State AI disclosure laws are unverified. Search budget ran out and the pages I tried failed: California Bus. & Prof. Code 17941 (403), Utah Code 13-75-103 (404, then 403), and a guessed Maine URL that turned out to be an unrelated section. I recall California, Utah, Maine and Colorado having relevant laws, and that recollection is not a finding. Needs a follow-up search.
- Any Maryland AI chatbot disclosure statute: not checked.
- The per-violation FTC penalty amount was not on the page.
- 16 CFR 465.4 and 465.7 text was read only through the FTC's summary, because ecfr.gov redirected to a block page.

## Data ownership: POS terms and customer data shared with an AI vendor

### Takeaway
On the pages I could read, the seller owns the data, access runs on the seller's permission, and revoking means deleting. Square has the clearest AI terms. A single shop is below Maryland's privacy law thresholds, but a platform that grows may not be.

### Cited findings
- Square: sellers keep ownership of their content, "Don't access or store a Square seller's information unless that seller allows it," no permanent copies without express consent, delete on revocation, and no storing card numbers. [Square Developer Terms](https://squareup.com/us/en/legal/general/developers) [page]
- Square also bars sublicensing or syndicating access to content, and limits access to "legitimate services to Square Sellers." [Square Developer Terms](https://squareup.com/us/en/legal/general/developers) [page]
- Maryland Online Data Privacy Act applies to a business that in the prior year processed personal data of at least 35,000 consumers, excluding data handled only to finish a payment, or at least 10,000 and got more than 20% of revenue from selling data. [Md. Com. Law 14-4702](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4702) [page]
- Anthropic: "may not train models on Customer Content from Services," the customer keeps its inputs and owns outputs, and Customer Content is confidential. [Anthropic commercial terms](https://www.anthropic.com/legal/commercial-terms) [page]
- Google requires notice to clients of account changes and a way out. [Business Profile policies](https://developers.google.com/my-business/content/policies) [verbatim]
- WhatsApp bars using platform data to train models or build user profiles. [Meta terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform) [page]

### Inferences
- Rules for a production system: send only needed fields to the model (first name, item, not a full customer record); no card numbers ever; delete on disconnect; no shared learning across shops from POS, Google or WhatsApp data. The last one conflicts with any "learn from all shops" claim, so keep aggregate claims to answers the owners give directly.
- A platform holding 35,000 customers' texts across shops could meet the threshold, though whether it would be a controller or a processor depends on the contract. Unsettled.
- Tell the owner in plain words what goes to the model vendor. Any "your data is safe" rating should apply to the platform itself.

### Gaps
- Toast's terms refused the fetch, so its rules on data and third parties are unread.
- Clover, DoorDash, Uber Eats and Grubhub merchant or developer data terms were not read.
- No privacy notice or customer disclosure duty for the shop was researched beyond these points.
