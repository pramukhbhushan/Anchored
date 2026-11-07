# Tools and ingestion for Backroom at independent US restaurants and corner stores

All facts checked Nov 7, 2026, US market, unless tagged with an earlier note. This is research, not legal advice.

How to read the tags:

- **Opened Nov 7**: I fetched the page. The fetch tool returns a model's summary, so short quotes are likely exact but should be spot-checked before publishing.
- **Snippet Nov 7**: seen only in search result text. I did not open the page.
- **Vendor**: the source sells the product or a competing or adjacent product. Treat it as a claim about itself. Every help or developer doc on a vendor's own domain is a vendor source.
- **Vendor-funded directory**: G2, Capterra, GetApp and similar.
- **CL** and **TBJ**: reused from `connectors_and_limits.md` and `tools_by_job.md`, checked Nov 6, 2026. Not reopened.
- **not stated**: the page I read does not say. **not found**: I looked and found nothing, or ran out of time. Neither proves it does not exist.
- **Est.**: my estimate, an inference. No vendor publishes how long an owner takes to get data out, and I timed nothing.

Limits of this run: the coordinator ended the run early, so Sling, McLane, Core-Mark, Sysco, SpotOn export, NRS export screens and Modisoft export are largely not found. Fetches refused or 404: exploretock.com pricing, constantcontact.com pricing, tacsecurity.com, help.marginedge.com, Square's App Marketplace pages at the two URLs I tried, and a Facebook Business help page.

## Do these owners use a CRM at all, and what fills that role?

### Takeaway
I found no survey measuring CRM use at independent restaurants or corner stores, so any percentage for them would be invented. General small business surveys, all vendor-run and mostly old, show email, spreadsheets and paper ahead of CRM. The tool docs show where customer lists really live: POS customer and loyalty lists, reservation guestbooks, email tools and delivery portals.

### Cited Findings
- 56% of surveyed small businesses did not use a CRM for customer data, 2023, all industries. [Zoho survey via Bigin](https://www.bigin.com/lp/state-of-customer-operations-2023.html) (Snippet Nov 7, vendor)
- Email 44% and spreadsheets 41% were the main ways to track customer information among 300+ US small business owners, 2016. [Salesforce](https://www.salesforce.com/news/?p=20855) (Snippet Nov 7, vendor, dated). A written customer ledger at 34% appears only in a secondary summary of that research. [MediaPost](https://www.mediapost.com/publications/article/293938/small-business-tech-is-still-emails-and-spreadshee.html) (Snippet Nov 7)
- A later Harris Poll for Salesforce of 490 US small business owners: 95% track customer data, by email 62% and spreadsheets 53%. Year not confirmed. [Salesforce](https://www.salesforce.com/in/blog/wp-json/wp/v2/posts/17633) (Snippet Nov 7, vendor; which of the two Salesforce links carries which figure is not confirmed)
- Restaurant email marketing: 18% said they run campaigns, undated, from direct interviews. Weak evidence. [Benchmark Email](https://ui.benchmarkemail.com/resources/manuals/restaurants/email-marketing-statistics) (Snippet Nov 7, vendor)
- 73% of 239 US convenience retailers "tout" a loyalty program, 2019, no split for independents. [PDI via Retail Customer Experience](https://www.retailcustomerexperience.com/blogs/pdi-2019-c-store-shopper-report-3-ways-to-turn-shoppers-into-loyal-customers/) (Snippet Nov 7, vendor survey)
- 77.2% of surveyed convenience shoppers were loyalty members in 2026. This measures shoppers, not independent stores, and likely reflects chains. [NACS](https://convenience.org/stay-current/news/2026/october/7/tobacco-lights-up-loyalty) (Snippet Nov 7)
- An earlier note found no source for loyalty use at independent corner stores. `corner_store_operations.md`, line 256, Nov 6.
- What fills the role, from product docs:
  - POS list: SpotOn's dashboard customer list "will include all marketing and loyalty customers." [SpotOn](https://spotonteam.atlassian.net/wiki/x/XgAtPw) (Snippet Nov 7, vendor). Toast holds Guestbook and Rewards Accounts. See the tools table.
  - Reservation guestbook: name, mobile, email, notes, tags and visit history. [Resy data transfer](https://helpdesk.resy.com/en_us/data-transfer-instructions-BkD17zouu.md) (Opened Nov 7, vendor)
  - Event pipeline: Tripleseat and Perfect Venue are the nearest thing to a true CRM here. See the tools table.

### Inferences
- Mine: treat "CRM" as the wrong word in onboarding. Ask "where do your customers' numbers live?" A restaurant probably has two to four partial lists. A corner store probably has none, apart from what is in the owner's phone and head. No source measures this, so test it in owner interviews.
- Mine: Backroom's first customer table should accept duplicates across sources and merge on phone or email, since Square, Toast and OpenTable each hold a partial view.

### Gaps
- Not found: any share of independent restaurants or corner stores using a CRM, a notebook or a POS customer list. The National Restaurant Association technology report did not surface. NACS's "Driving Engagement" report is members-only.

## For each tool: price, data, and how it gets out

### Takeaway
Self-serve API access for one shop exists at Square, Clover by merchant token, Mailchimp, Klaviyo, 7shifts and MarginEdge, with limits noted below. Almost everything else is a CSV from a web back office. Toast, Resy, DoorDash, Uber Eats, Grubhub, Yelp's lead API and Google Business Profile have a gate. I found no public path at all for NRS, Modisoft, Hisably, McLane or Core-Mark beyond files and photos.

### Cited Findings

Tools table. Price is for one location. "Gate" means what stands between Backroom and the data.

| Tool | Monthly price | Data held | Fastest real path out | API path and gate | 10-minute? |
|---|---|---|---|---|---|
| Square | Free $0, Plus $49, Premium $149 (TBJ) | Customers, orders, payments, catalog, inventory, labor | Dashboard, Customer Directory, Import/Export, Export Customers, then Download CSV. [Noterro](https://www.noterro.com/help-articles/12669264605844), [Square community](https://community.squareup.com/t5/Payments-Troubleshooting/How-can-I-export-my-customer-list/m-p/327891) (Snippet Nov 7). Older staff post says auto-collected names are excluded, so test. Reports: Reports, pick report, export icon, Start export. [Square help](https://squareup.com/help/us/en/article/8362-print-export-or-email-your-reports) (Snippet Nov 7, vendor) | OAuth with PKCE or code flow. Access token 30 days, code flow refresh token does not expire, PKCE refresh single-use and 90 days. [Square OAuth](https://developer.squareup.com/docs/oauth-api/overview) (Opened Nov 7, vendor). Scopes and webhooks in CL. Listing need for real sellers: not found | Yes if OAuth works unlisted. Test first |
| Toast | Point of Sale $69, Starter Kit $0 with higher card fees. [G2](https://www.g2.com/products/toast/pricing) (Snippet Nov 7, vendor-funded directory); [Toast blog](https://pos.toasttab.com/vi-us/blog/on-the-line/how-much-does-a-restaurant-pos-system-cost) (Snippet Nov 7, vendor) | Orders, payments, labor, menu, guests, loyalty | Toast Web, Reports, open report, download icon for CSV, or Email Export to any addresses. [Toast](https://support.toasttab.com/en/article/Export-a-Filtered-Report-With-Custom-Columns?lang=en_US) (Opened Nov 7, vendor). Loyalty: Reports, Marketing, Rewards Accounts, download. [Toast](https://support.toasttab.com/en/article/Export-Toast-Loyalty-Data-for-Third-Party-Use?lang=en_US) (Opened Nov 7, vendor). Guests: Marketing, Guestbook, Guest Export, emailed CSV link. [Spillover](https://support.spillover.com/portal/en/kb/articles/how-to-export-your-toast-guest-list-and-import-it-into-your-engage-subscriber-db) (Snippet Nov 7, vendor, confirm menu). Catering customers: Catering & Events, Customers, Download CSV. [Toast](https://support.toasttab.com/en/article/Get-Help-Toast-Catering-and-Events?lang=en_US) (Snippet Nov 7, vendor) | Nightly files: Order Details, Payment Details, Item Selection, Time Entries, Menu and others, by FTP or CLI after closeout, 4 a.m. by default. [Toast](https://doc.toasttab.com/doc/platformguide/adminDataExportOverview.html) (Opened Nov 7, vendor). Standard API is read-only, needs Essentials and a location employee. Partner path is long (CL) | CSV only |
| Clover | Essentials $14.95, Counter $59.95, Table $89.95, Retail Growth $84.95, 36 or 48 month contract per third party (TBJ) | Customers, orders, inventory, payments | Customers, Top Spenders, Export CSV. [BuyFi](https://buyfi.freshdesk.com/support/solutions/articles/13000000277-how-can-i-identify-may-top-spenders-birthdays-and-how-can-this-be-sorted-) (Snippet Nov 7, third party). Another source reports Excel only on the customer list. [Community](https://community.clover.com/answers/4251/view.html) (Snippet Nov 7) | Merchant makes a token at Account & Setup, API Tokens, picks Read. [Pinogy](https://pinogy.atlassian.net/wiki/spaces/PP/pages/3854106634/Clover+Export+Instructions) (Opened Nov 7, vendor). Clover calls these "ideal for internal tools," and multi-merchant work "is required" to use OAuth. OAuth tokens last 30 minutes. [Clover FAQ](https://docs.clover.com/dev/docs/oauth-and-tokens-faqs) (Opened Nov 7, vendor). App Market approval: time not stated (CL) | Token works but is a pilot-only path |
| SpotOn | Essentials $55 per station, or All-In $0 with 2-year minimum (TBJ) | Marketing and loyalty customers, sales | Customer list import by CSV template is documented. Export: not found. [SpotOn](https://spotonteam.atlassian.net/wiki/x/XgAtPw) (Snippet Nov 7, vendor) | not found | Unknown |
| NRS | Basic $19.95 with NRS Pay, $29.95 without, up to $109.95; contract required (TBJ) | Item sales, inventory, users | "Export reports in Excel/CSV" (CL). Exact screen: not found. Reports appear on POS, merchant portal and app for the Advanced Data add-on. [NRS](https://nrsplus.com/advanced-data) (Snippet Nov 7, vendor) | No public developer docs found (CL) | CSV if the portal cooperates |
| Modisoft | Plus $69, Advanced $89 (TBJ) | Sales, lottery, fuel, tobacco scan data | Export screen: not found. A third party says the Modisoft file is sent by email. [Fintech](https://knowledge.fintech.com/retailer-kb/integrating-with-modisoft) (Snippet Nov 7, third party) | GetApp says no API (CL) | Photo instead |
| Lightspeed | Retail Basic $89, Core $149, Plus $289 (TBJ). Restaurant price: not found | Customers, sales, inventory | K-Series Back Office: Customers, Customer list, Export. [Lightspeed](https://k-series-support.lightspeedhq.com/hc/articles/1260804656409) (Snippet Nov 7, vendor; exact article attribution uncertain). X-Series has a customer list export. [Lightspeed](https://x-series-support.lightspeedhq.com/hc/articles/25534210440987) (Snippet Nov 7, vendor) | Retail uses OAuth2, details on separate pages. [Lightspeed](https://developers.lightspeedhq.com/retail/introduction/introduction/) (Opened Nov 7, vendor). K-Series needs the development partner program, staging client then production. [Codat](https://docs.codat.io/integrations/commerce/lightspeed-k/commerce-lightspeed-k-setup) (Snippet Nov 7, vendor) | CSV only |
| OpenTable | Conflicting. Basic $149, Core $299, Pro $499 plus cover fees is most cited. Others differ. [Eat App](https://restaurant.eatapp.co/blog/opentable-pricing) (Snippet Nov 7, competitor). Vendor price page not opened | Guests, reservations | Reporting, Guest Export, all profiles, emailed CSV link. [Resy](https://helpdesk.resy.com/en_us/data-transfer-instructions-BkD17zouu.md) (Opened Nov 7, competitor). Link expires in 48 hours. [Spillover](https://support.spillover.com/portal/en/kb/articles/how-to-export-import-your-opentable-email-list) (Snippet Nov 7, vendor) | not found | Yes, once the email arrives |
| Resy | Platform $289, Platform 360 $459, no per-cover fees. [Resy](https://resy.com/join/plans-pricing/) (Opened Nov 7, vendor). Older snippets show $249 and $399, so the opened page wins | Guests, reservations | Resy's own export steps: not found. The help page covers imports only | No public API; partner team only. [Carly](https://www.usecarly.com/blog/resy-api/) (Snippet Nov 7, vendor) | Unknown |
| Tock | Essential $289 with 3% prepayment fee, Premium $459 with 2%, as listed on Resy's page. [Resy](https://resy.com/join/plans-pricing/) (Opened Nov 7, vendor). Tock's own page refused the fetch | Guests, reservations, prepayments | Guestbook: email hospitality@tockhq.com, arrives as four files, no time stated. Reservations: Operations, Reservations, Download, emailed. [Resy](https://helpdesk.resy.com/en_us/data-transfer-instructions-BkD17zouu.md) (Opened Nov 7, vendor). Weekly guest view: Operations, Guests. [Fishbowl](https://docs.fishbowl.com/knowledge/tock) (Snippet Nov 7, vendor) | not found | No, needs Tock staff |
| Yelp Guest Manager | $199 Host pricing tier noted in TBJ. Guest Manager price: not found | Guests, reservations | Guests, Filters, Export guests. Non-opted-in guests show "Unavailable." [Resy](https://helpdesk.resy.com/en_us/data-transfer-instructions-BkD17zouu.md) (Opened Nov 7, competitor) | See Yelp row | Partial |
| Tripleseat | No public price. Directories conflict at $99 and $400 (TBJ) | Leads, events, accounts, contacts, payments | CSV: not found | REST API, OAuth 2.0, webhooks such as CREATE_LEAD, public lead form. [Supergood](https://supergood.ai/docs/tripleseat-api) (Snippet Nov 7, vendor). Who may get keys: not found | Unknown |
| Perfect Venue | Free plan; Professional $199 annual or $239 monthly; Premium $299 or $339 (TBJ) | Leads, contacts, events | Zapier triggers exist. [Zapier](https://zapier.com/apps/perfect-venue/integrations) (Snippet Nov 7) | Conflict: vendor help (Oct 2024) describes OAuth API over accounts, contacts and events. [Perfect Venue](https://support.perfectvenue.com/articles/681153-perfect-venue-s-api-documentation) (Snippet Nov 7, vendor). A report card says only a write-only Enterprise leads API. [Supergood](https://supergood.ai/api-report-card/perfect-venue) (Snippet Nov 7, vendor) | Unknown |
| ezCater | Free to list, 15% commission plus 2.99% fee (TBJ) | Orders, customers on ezOrdering and Direct Entry | Customers CSV for ezOrdering and Direct Entry only. [ezCater](https://catering.ezcater.com/en/help/manage-customers) (Snippet Nov 7, vendor). Reports tab lists order fields; download format not stated. [ezCater](https://catering.ezcater.com/help/reports-tab) (Snippet Nov 7, vendor). Marketplace customers not stated | not found | Partial |
| Mailchimp | Free 250 contacts and 500 sends since Jan 2026, Essentials from $13, Standard from $20, per third parties. [Activepieces](https://www.activepieces.com/blog/mailchimp-pricing-in-2026-full-breakdown-and-hidden-costs.md) (Snippet Nov 7, vendor). Vendor page not opened | Contacts, tags, campaign activity | Audience, Export audience, Export CSV, emailed when ready. ZIP with one CSV per status, kept 30 days. [Mailchimp](https://mailchimp.com/help/view-export-contacts/) (Opened Nov 7, vendor) | Self-serve app registration, no review mentioned, webhooks exist. Scopes and token life not on page. [Mailchimp](https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/) (Opened Nov 7, vendor) | Yes |
| Klaviyo | Free 250 profiles and 500 emails. Email $20, Marketing $25 at 500 profiles. [Klaviyo](https://www.klaviyo.com/pricing) (Opened Nov 7, vendor) | Profiles, events, flows | Lists & Segments, list, Manage List, Export List to CSV. Owner, Admin or Analyst only. Downloads under Settings, Other, Downloads for 30 days. [Klaviyo](https://help.klaviyo.com/hc/en-us/articles/115005078687) (Snippet Nov 7, vendor) | OAuth with required PKCE S256, 1-hour access token, refresh revoked after 90 days unused. Install URL can be shared without a listing. Listing needs 5 active installs. [Klaviyo](https://developers.klaviyo.com/en/docs/set_up_oauth) (Opened Nov 7, vendor) | Yes |
| Constant Contact | not found, page refused the fetch | Contacts, lists | Contacts, select, Actions, Export selection, then Download CSV or Excel. [Constant Contact](https://knowledgebase.constantcontact.com/email-digital-marketing/articles/KnowledgeBase/54039-Export-your-contacts?lang=en_US) (Snippet Nov 7, vendor) | New apps "are limited to private access," and open access starts with a call to 866-289-2101. [Constant Contact](https://developer.constantcontact.com/api_guide/getting_started.html) (Opened Nov 7, vendor) | CSV yes, OAuth no |
| DoorDash | Commission 15%, 25% or 30% delivery (TBJ) | Orders, payouts, ratings | Merchant Portal, Reports, Create report, Financial Report, one-time or recurring, then download icon. Admin or Manager only, available 7 days. [DoorDash](https://help.doordash.com/en-au/merchants/article/financial-information) (Snippet Nov 7, vendor; page seen is the AU version, and one line says only US merchants can download the Payouts CSV through the builder) | Partner review quarterly; Reporting API opt-in (CL) | Yes, with a wait for the report |
| Uber Eats | Commission 20%, 25% or 30% (TBJ) | Orders, payments, errors | restaurants.uber.com, Payment History, CSV column download. [Uber](https://help.uber.com/h/51a4bf78-6b4e-47d3-898f-606b70ad1b9f) (Snippet Nov 7, vendor). Reports, Request reports, Payment details. [Uber, Chile page](https://merchants.ubereats.com/cl/en/resources/learning-center/uber-eats-manager/) (Snippet Nov 7, vendor, US labels may differ) | Partner approval, NDA (CL) | Yes |
| Grubhub | Marketing tiers 5%, 15%, 20% plus 10% for its delivery (TBJ) | Orders, payouts | Portal export steps: not found. Order emails can be parsed. [Mailparser](https://mailparser.io/template/grubhub-order-management-templates/) (Snippet Nov 7, vendor) | POS integration program (CL) | Forward order emails |
| Google Business Profile | Free | Reviews, messages, insights | Google Takeout, Business Profile, gives `Reviews.json`. [The Bricks](https://www.thebricks.com/resources/guide-how-to-export-google-reviews-to-excel) (Snippet Nov 7, third party, a one-time backup). Insights and messages export: not found | 60-day-old verified profile, form, quota 0 until approved, 30-day storage limit (CL) | Paste only |
| Yelp | Listing free. Fusion API $229 to $643 per a scorecard. [Supergood](https://supergood.ai/api-report-card/yelp) (Snippet Nov 7, vendor, conflicts exist) | Reviews, leads, messages | No export of own reviews or messages, per third party. Zapier is the pointer. [Supergood](https://supergood.ai/api-report-card/yelp-for-business) (Snippet Nov 7, vendor) | Leads API reserved for reseller partners, same source | Paste only |
| Instagram | Free | DMs, comments, posts | See inbound channels section | Instagram Login API, Advanced Access for other people's accounts | No |
| QuickBooks Online | Free $0 listed, Simple Start $38, Essentials $85, Plus $140, Advanced $340. [Intuit](https://quickbooks.intuit.com/pricing/) (Opened Nov 7, vendor) | Customers, invoices, payments, expenses | Reports, pick report, Export, Export to Excel. Customer Contact List report covers customers. [Intuit](https://quickbooks.intuit.com/learn-support/en-ca/help-article/report-management/export-reports-excel-quickbooks-online/L7iAoP97n_CA_en_CA) (Snippet Nov 7, vendor) | Production keys need an assessment questionnaire, about 30 minutes to fill. [Codat](https://docs.codat.io/integrations/accounting/quickbooksonline/qbo-app-assessment-questionnaire) (Snippet Nov 7, vendor). Builder tier gives 500,000 CorePlus calls a month free. [Intuit FAQ](https://developer.intuit.com/app/developer/qbo/docs/get-started/partner-faq) (Snippet Nov 7, vendor). OAuth page was empty on fetch, so scopes are not confirmed | OAuth likely, after keys |
| Xero | Early $27, Growing $59, Established $97. [Xero](https://www.xero.com/us/pricing-plans/) (Opened Nov 7, vendor) | Contacts, invoices, bank lines | Report export steps: not checked | Starter tier is free but 5 connections and 1,000 calls per day per org; Core is AUD 35 for 50 connections. [Xero](https://developer.xero.com/pricing) (Opened Nov 7, vendor). Terms bar using API data to train AI models. [Xero FAQ](https://developer.xero.com/faq/pricing-and-policy-updates) (Snippet Nov 7, vendor). Scopes page empty on fetch | Yes for 5 shops |
| 7shifts | Free one location to 15 staff; paid tiers conflict (TBJ) | Staff, shifts, punches, sales | Team, Employees bulk export, or Reports, Employee Export. Wage columns need a permission. [7shifts](https://kb.7shifts.com/hc/en-us/articles/35847046498835) (Snippet Nov 7, vendor) | Any customer can make a company token, per a connector. [Sling Data](https://docs.slingdata.io/connections/api-connections/7shifts) (Snippet Nov 7, vendor). Docs index only on fetch. Plan limits: not found | Token possible |
| Homebase | Basic $0, Essentials $30, Plus $70, All-in-One $120 (TBJ) | Staff, timesheets | Timesheets, set dates, Download. [Homebase](https://www.joinhomebase.com/integrations/heartland) (Snippet Nov 7, vendor) | not found | CSV |
| Sling | Free to 30 users, Premium $2, Business $4 per user (TBJ) | Staff, shifts | not found | not found | Unknown |
| MarginEdge | $350, onboarding extra (TBJ) | Invoices, items, vendors | Accounting, Export, CSV format option. [MarginEdge](https://help.marginedge.com/hc/en-us/articles/360036416174) (Snippet Nov 7, vendor) | Public read-only API, "no extra cost," covers invoices, products, vendors, not sales or inventory. [MarginEdge](https://help.marginedge.com/hc/en-us/articles/28081506932499-MarginEdge-Public-API) (Snippet Nov 7, vendor; opening it returned 403) | Likely |
| xtraCHEF | Price not confirmed by vendor (TBJ) | Invoices, items | Export CSV, Detailed Report. [5-Out](https://intercom.help/5-out-knowledge-center/en/articles/8365581-xtrachef-set-up) (Snippet Nov 7, vendor) | Native only to Toast and QuickBooks, others by data exchange through support. [Toast](https://intercom.help/toast-central/en/articles/14727658-xtrachef-integrations-and-data-exchanges) (Snippet Nov 7, vendor) | CSV |
| Hisably | $30, plus $15 for documents (TBJ) | Lottery, gas, payables, sales | Page lists no export or integration. Daily Reports are "delivered directly to your email inbox," format not stated. [Hisably](https://www.hisably.com/pricing) (Opened Nov 7, vendor) | not found | Forward the email |
| US Foods | Price not stated | Orders, invoices, order guide | MOXe: ellipsis menu lets you view, download or print a document. [US Foods](https://www.usfoods.com/how-we-help-you/easy-ordering/moxe-help-center/payments-on-moxe) (Snippet Nov 7, vendor). Older site: up to 50 invoices as a ZIP. [UNA guide](https://una.com/wp-content/uploads/2024/06/US-Foods-Help-Center-Instructions.pdf) (Snippet Nov 7). Order guide CSV per third party only | not found | Photo or PDF |
| Sysco | Price not stated | Orders, invoices | Third-party note on a CSV with "Include pricing information." [Hospitality Innovations](https://hospitality-innovations.notion.site/Uploading-Sysco-Items-29a4dad25bf58092922eeda78d0f8cf8) (Snippet Nov 7, vendor, unverified) | not found | Photo |
| Restaurant Depot | Membership price not checked | Receipts, purchase history | Online account, Receipts tab. File export not stated. [Restaurant Depot](https://www.restaurantdepot.com/?p=24729) (Snippet Nov 7, vendor) | not found | Photo |
| McLane, Core-Mark | Price not stated; access through a rep (TBJ) | Orders, invoices | not found | not found | Photo |
| Gmail | Free consumer | Leads, invoices, vendor mail | See 10-minute section | Restricted scopes | Forward only |
| WhatsApp Business app | Free | Customer chats | Open chat, three-dot menu, export, ZIP. Disappearing messages excluded. [WhatsApp](https://faq.whatsapp.com/1180414079177245) (Opened Nov 7, vendor). This version says "Media isn't included, unlike exporting chats on your mobile device" | See inbound channels | Yes, one chat |
| Paper invoices | Free | Vendor, lines, total | Phone photo, Claude vision, Zod check. About $1.30 per 1,000 images at Haiku 4.5 rates (CL) | None needed | Yes |

### Inferences
- Mine: rule for the data ownership screen. Show only "connect" for Square and Mailchimp at launch. Everything else starts as a file or a photo.
- Mine: Xero's free tier stops at 5 connections and QuickBooks needs a questionnaire, so neither is a launch-week connector unless an accounting-heavy pilot demands it.
- Mine: Xero's training bar matches Square's in CL, so a single product rule covers both: no training on any connected data.

### Gaps
- Square: whether a production OAuth app can connect real sellers without a Marketplace listing. Square's docs describe production credentials and an HTTPS redirect, with QA review tied to Marketplace submissions ([move to production](https://developer.squareup.com/docs/oauth-api/movetoprod), [publishing](https://developer.squareup.com/docs/app-marketplace), Snippet Nov 7, vendor). No page I saw says it outright. My reading is no listing needed. Test with one real seller before promising it.
- Whether Clover allows a merchant token to be handed to an outside app, and the same for Toast credentials. Both look like gray areas.
- Not found: Sling, SpotOn export, Modisoft export, NRS screens, Grubhub portal steps, McLane and Core-Mark files, Tock's own price page, Constant Contact's price, Yelp's own docs, Xero and QuickBooks scope lists.

## What is the fastest honest 10-minute ingest, and which paths need Google review?

### Takeaway
Reading Gmail is out for launch. `gmail.readonly` is a restricted scope, which means verification plus a yearly third-party security assessment if data sits on your servers, and the Google-published process has no firm time. Calendar needs sensitive verification, days to weeks. A forwarded email to a Backroom address, a photo, a pasted list and a voice note need no one's approval, and they should be the default. `drive.file` with Google Picker is the one Google route that is non-sensitive, per Google's scope table.

### Cited Findings

Ingest comparison. Owner times are Est., mine, and untested.

| Ingest | Owner time, Est. | Approval needed | Phone only? | Best for | Evidence |
|---|---|---|---|---|---|
| Pasted list or voice description | 1 to 3 min | None | Yes | Business Profile, top customers, vendors | Mine. No vendor source applies |
| Photo of invoice or shelf | 1 min each | None | Yes | Invoices first. Shelf accuracy is unproven | CL, TBJ |
| Forward one email to a Backroom address | 30 sec each | None for the owner. Backroom needs an inbound email service | Yes | Vendor invoices, order emails, catering asks, emailed reports | Inbound services below |
| Gmail auto-forward with filter | 3 to 5 min, needs a computer | Link click from the destination | No | Ongoing invoices, leads | [Gmail help](https://support.google.com/mail/answer/10957) (Opened Nov 7, vendor) |
| Square OAuth click | 1 min if logged in | Seller consent. Listing question open | Yes, by inference | Square shops | [Square OAuth](https://developer.squareup.com/docs/oauth-api/overview) (Opened Nov 7, vendor) |
| CSV export walkthrough | 3 to 10 min, plus any email wait | None | Often no | POS, reservations, email tools, delivery | Tools table |
| Shared Google Sheet by Picker | 2 min | `drive.file` is non-sensitive, per Google | Web library, mobile browser use not stated | Owners who already keep a sheet | [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [Picker](https://developers.google.com/workspace/drive/picker/guides/overview) (Opened Nov 7, vendor) |
| Google sign-in, Calendar | 1 min for owner | Sensitive verification | Yes | Hours, bookings | See below |
| Google sign-in, Gmail read | 1 min for owner | Restricted verification and yearly assessment | Yes | Do not use at launch | See below |

Gmail and Google review facts:

- Restricted: `gmail.readonly`, `gmail.metadata`, `gmail.modify`, `gmail.compose`, `gmail.insert`, `gmail.settings.basic`, full `mail.google.com`. Sensitive: `gmail.send`, `gmail.addons.current.message.readonly`, `gmail.addons.current.message.metadata`. Non-sensitive: `gmail.labels`, two add-on action scopes. "If you store restricted scope data on servers (or transmit), then you must go through a security assessment." [Gmail scopes](https://developers.google.com/gmail/api/auth/scopes) (Opened Nov 7, vendor). A search summary wrongly called `gmail.readonly` sensitive. The Google page wins.
- CASA is "the final step of the restricted scopes review process," with assurance levels AL1 and AL2, and "All applications must be revalidated every year." Cost and who pays are not stated. [Google security assessment](https://support.google.com/cloud/answer/13465431) (Opened Nov 7, vendor). "applications must pass an annual security assessment and obtain a Letter of Assessment from a Google-designated third party." [Google API data policy](https://developers.google.com/terms/api-services-user-data-policy) (Opened Nov 7, vendor). The developer pays per [Mimestream](https://mimestream.com/blog/casa-verified), "we selected and paid for this assessment," Tier 2, repeated yearly (Opened Nov 7, independent Gmail client).
- CASA price evidence conflicts, and no Google source gives one:
  - TAC Security $540 to $720; Netsentries about $700; Prescient $3,000 and up, prices as of Aug 2025. [Nango](https://nango.dev/docs/api-integrations/google-shared/google-security-review.md) (Opened Nov 7, vendor).
  - TAC $540 with premium to $1,800, labeled "as of 2024." [Switch Labs](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option) (Opened Nov 7, vendor).
  - Leviathan's own page lists AL1 at $3,000, $4,500 or $6,000 by start date. [Leviathan](https://leviathansecurity.com/programs/google-casa-cloud-application-security-assessment) (Opened Nov 7, vendor). Switch Labs lists Leviathan at $800 to $1,200, so that comparison table looks stale.
  - TAC's own page refused the fetch. A competitor's claim of $15,000 to $75,000 appeared in results and has no support I could check. [Unipile](https://www.unipile.com/integrating-google-oauth-2-0-user-authentication-into-your-app/) (Snippet Nov 7, vendor)
- CASA timing conflicts: Nango says 5 to 20 days if prepared, and reports Google's own estimate as 4 to 6 weeks. [Nango](https://nango.dev/docs/api-integrations/google-shared/google-security-review.md) (Opened Nov 7, vendor). A developer reports 6 to 8 weeks. [Latenode forum](https://community.latenode.com/t/is-casa-tier-2-assessment-necessary-for-all-gmail-api-apps-options-for-indie-developers/22861) (Snippet Nov 7). One sensitive-only review shows stuck since April 2026. [Google developer forum](https://discuss.google.dev/t/oauth-verification-stuck-in-review-since-april-2026-sensitive-scopes-only-no-trust-safety-email-received/374317) (Snippet Nov 7). Sensitive verification is "3 to 5 business days" per one vendor. [Nylas](https://www.nylas.com/blog/google-oauth-app-verification/) (Snippet Nov 7, vendor). I did not find that figure on a Google page.
- Limits without verification: "100 new users in total, after the app presents the unverified app screen." Test builds and internal Workspace apps are exempt. Personal use is not addressed. [Google](https://support.google.com/cloud/answer/7454865) (Opened Nov 7, vendor). In Testing status, refresh tokens "expire after 7 days." [Google Health setup](https://developers.google.com/health/setup) (Snippet Nov 7, vendor, written for the Health API).
- Limited Use on sensitive and restricted scopes: "Limit your use of data to providing or improving user-facing features," no ads use, and "Don't allow humans to read the data, unless" the user agreed for specific data, security, law, or aggregated internal operations. The policy page does not mention AI training in what I read. "permitted Application Type" for Gmail is on a product page I did not open. [Google policy](https://developers.google.com/terms/api-services-user-data-policy) (Opened Nov 7, vendor)
- Gmail push needs Pub/Sub, `users.watch` renewed at least every 7 days, and a `history.list` fallback. [Gmail push](https://developers.google.com/workspace/gmail/api/guides/push) (Opened Nov 7, vendor). Scope for watch: not stated on that page.
- Calendar: 20 scopes listed, classification not on the page. [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth) (Opened Nov 7, vendor). Google uses reading Calendar events as a sensitive example. [Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) (Snippet Nov 7, vendor). `calendar.app.created` tier not confirmed. [Google forum](https://discuss.google.dev/t/oauth-verification-pending-since-22-apr-2026-first-trust-safety-email-never-received/392005) (Snippet Nov 7)
- Sheets: `drive.file` non-sensitive, `spreadsheets` and `spreadsheets.readonly` sensitive, `drive` and `drive.readonly` restricted. [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes) (Opened Nov 7, vendor). Picker returns file IDs and URLs after a user picks. [Picker](https://developers.google.com/workspace/drive/picker/guides/overview) (Opened Nov 7, vendor)
- Inbound email services: Resend receives on all plans with a signed `email.received` webhook that carries metadata only, so the body and attachments need a second API call, kept 30 days. Cloudflare Email Routing runs a Worker on raw MIME, free inbound, messages to 25 MiB. Postmark posts parsed JSON to one webhook per inbound stream. [Sequenzy](https://www.sequenzy.com/blog/best-free-inbound-email-apis) (Snippet Nov 7, vendor), [Postmark](https://postmarkapp.com/developer/webhooks/inbound-webhook) (Snippet Nov 7, vendor). Current pricing: not confirmed.

Ingestion table. Destination tables are my proposed names, for the writer to map onto the real schema.

| Data | Tool | Method | Time, Est. | Partner approval? | Lands in |
|---|---|---|---|---|---|
| Business facts | Owner | Voice or paste, Claude extracts, Zod check, owner confirms | 3 min | No | `business_profile` |
| Customers | Square | OAuth `CUSTOMERS_READ`, webhook `customer.*` | 1 min | Listing question open | `customers` |
| Customers | Square, Clover, Lightspeed | CSV upload | 5 to 10 min, computer | No | `customers` |
| Guests | OpenTable, Yelp | Emailed CSV, forward or upload | 5 min plus email wait | No | `customers` with source tag |
| Guests | Tock | Email Tock staff | Days, not stated | Staff action | `customers` |
| Contacts | Mailchimp, Klaviyo | CSV, later OAuth | 3 to 5 min | No | `customers`, consent flag kept |
| Orders, payments | Square | OAuth, `order.*`, `payment.*` webhooks | 1 min | Listing question open | `orders`, `payments` |
| Orders, payouts | Toast | Reports CSV or Email Export to the Backroom address | 5 min | No | `orders`, `payments` |
| Payouts | DoorDash, Uber Eats | Portal CSV | 5 to 10 min, computer | No | `payments` with channel |
| Orders | Grubhub | Forward order emails | 1 min to set rule, computer | No | `orders` |
| Leads | Phone | Twilio number, `DialCallStatus` webhook | 5 min with forwarding | No for voice | `leads`, `messages` |
| Leads | Website | Hosted form or embed to Next.js route | 2 min | No | `leads` |
| Leads, invoices | Email | Alias at Backroom, forward or filter | 1 to 5 min | No | `messages`, `leads`, `documents` |
| Leads | Tripleseat, Perfect Venue | Webhook or CSV, access unconfirmed | Unknown | Unknown | `leads` |
| Leads | Meta Lead Ads | Owner downloads CSV, or webhook with App Review | Weeks for webhook | Yes | `leads` |
| DMs | Instagram | Paste now, API later | Weeks for API | Yes | `messages` |
| Chats | WhatsApp | Export chat from phone, one at a time | 1 min each | No | `messages`, labeled as an owner export |
| Reviews | Google, Yelp | Paste, owner-supplied label | 1 min each | No | `reviews` |
| Invoices | Paper, wholesalers | Photo or PDF, Claude vision, arithmetic check | 1 min each | No | `documents`, `invoice_lines` |
| Books | QuickBooks, Xero | Report export, later OAuth | 5 min | Questionnaire or tier limits | `payments`, `expenses` |
| Schedules | 7shifts, Homebase | CSV, 7shifts token later | 5 min | No | `staff`, `shifts` |
| Food cost | MarginEdge, xtraCHEF | CSV, MarginEdge API later | 5 min | No, API key path unconfirmed | `invoice_lines` |

Repeatable 10-minute onboarding workflow. Mine, built from the facts above, untimed. Test with a stopwatch on three owners before quoting "10 minutes."

| Minute | Step | Owner does | Backroom does | Failure fallback |
|---|---|---|---|---|
| 0 to 1 | Sign in | Enters phone number, gets a code | Creates shop, gives forwarding address | Email link |
| 1 to 3 | Context | Talks for 90 seconds: name, hours, what they sell, who they buy from, what eats their time | Claude drafts Business Profile, code validates, owner taps to fix | Type it |
| 3 to 4 | Which systems | Taps logos: POS, reservations, delivery, books, or "paper and phone" | Picks the next steps, hides the rest | "Paper and phone" path |
| 4 to 6 | First real data | Square: one OAuth tap. Anyone else: photo of the last two invoices | Reads, checks arithmetic, shows lines to confirm | Paste a list |
| 6 to 7 | Customers | Pastes or dictates top customers, or says "later" | Merges, marks consent unknown so nothing is texted | Skip |
| 7 to 9 | Inbound | Picks number option. Forward on no answer using a carrier code shown for their carrier. Test call | Shows the missed-call event live | Publish the Twilio number, or skip |
| 9 to 10 | First win | Sees a morning brief built from what came in, approves one draft | Labels simulated or sample data on screen | Show what is missing |
| After | Homework | Emails self a link to do CSV exports on a computer | Sends a checklist by tool with the exact screen path, plus a Backroom address for Toast Email Export | None needed |

### Inferences
- Mine: Toast's Email Export takes any address, so an owner could send a report straight to Backroom without handling a file. The same pattern fits Hisably's emailed reports and OpenTable's emailed link if forwarded. This is the best phone-friendly trick I found, and I have not tested that a Backroom inbound address accepts those messages.
- Mine: for email, the safe launch is forward only, with `gmail.send` not needed either since Twilio and Backroom's own domain can send. Add a read scope only after paying customers justify the review.
- Mine: a Gmail auto-forward setup needs Backroom to catch Google's confirmation mail and show the link to the owner, since Google sends it to the destination address. Google's page describes a verification link.
- Mine: do not auto-forward a whole mailbox. A filter limited to invoice or vendor senders avoids holding personal mail, and it matches Limited Use thinking even though forwarding is outside the API policy.
- Mine: a Gmail add-on with `gmail.addons.current.message.readonly` could read only the open message on a sensitive scope. I did not check phone support, so leave it as a later idea.

### Gaps
- Not checked: public link CSV export of a Google Sheet, and Picker on a phone browser. Both need a device test.
- Not found: Google's own published review times for sensitive or restricted scopes. The Gmail permitted application types page was not opened.
- Not found: any timed study of owners on these exports.

## Can a phone-only owner export a CSV?

### Takeaway
Often not. Square staff say a computer is needed for report downloads, and Google documents Gmail forwarding only on a computer. Exports that email a link are the usable pattern on a phone. So the 10-minute path must not depend on a CSV.

### Cited Findings

| Tool | Phone status | Source |
|---|---|---|
| Square reports | "you'll need to use a web browser on a computer or laptop" | [Square community](https://community.squareup.com/t5/Payments-Troubleshooting/export-sales-report-as-a-excel-or-numbers-file/m-p/761172) (Snippet Nov 7, vendor staff) |
| Square Dashboard app | Summaries. For detail, "visit your online Square Dashboard via a web browser" | [Square help](https://squareup.com/help/au/article/5618) (Snippet Nov 7, vendor) |
| Square OAuth | Browser flow, phone use not stated. Tokens must not sit on native mobile clients | [Square](https://developer.squareup.com/docs/oauth-api/movetoprod) (Snippet Nov 7, vendor) |
| Toast reports | Article covers Toast Web, mobile not stated. Email Export sends a link | [Toast](https://support.toasttab.com/en/article/Export-a-Filtered-Report-With-Custom-Columns?lang=en_US) (Opened Nov 7, vendor) |
| Clover | Import says use a browser on PC or Mac. Export on phone not stated | [BuyFi](https://buyfi.freshdesk.com/support/solutions/articles/13000022187-how-can-import-a-customer-list-) (Snippet Nov 7, third party) |
| Gmail forwarding | Instructions given only for a computer | [Gmail help](https://support.google.com/mail/answer/10957) (Opened Nov 7, vendor) |
| QuickBooks | Mobile export "may be limited," per third party | [Cleverence](https://www.cleverence.com/articles/quickbooks-documentation/export-your-reports-to-excel-from-quickbooks-online-5832) (Snippet Nov 7, vendor) |
| Mailchimp | App links shown, export in app not stated. Email notice when ready | [Mailchimp](https://mailchimp.com/help/view-export-contacts/) (Opened Nov 7, vendor) |
| ezCater | ezManage app views orders, makes PDFs | [ezCater](https://ezcater.com/company/ezmanage-app) (Snippet Nov 7, vendor) |
| WhatsApp | Export works from a phone, and the page implies phone exports can carry media | [WhatsApp](https://faq.whatsapp.com/1180414079177245) (Opened Nov 7, vendor) |
| Hisably | Upload "from phone or computer" | [Hisably](https://www.hisably.com/pricing) (Opened Nov 7, vendor) |
| NRS, Modisoft, Lightspeed, OpenTable, Resy, Tock, DoorDash, Uber Eats, 7shifts, Homebase, MarginEdge | not stated in what I read | |

### Inferences
- Mine: assume desktop for anything labeled Dashboard, Back Office, Web or Portal until a phone test says otherwise. A phone browser in desktop mode may work, but I did not test any.
- Mine: the Backroom upload field should accept a file from the phone's Files app and from Gmail's attachment share, since an emailed CSV is what phone owners will hold.
- Mine: offer "send me the steps for my computer" rather than walking a phone owner through a screen they cannot reach.

### Gaps
- No device tests were run. Every "phone" cell above is a doc reading. Run a one-hour test on a real iPhone and Android for Square, Toast, OpenTable, DoorDash and Uber Eats.

## Which inbound channels can capture leads, and what needs verification?

### Takeaway
A Twilio number with forwarding, a web form and an email alias need no outside verification to capture a lead. Replying by text does need A2P registration. Meta Lead Ads, Instagram DMs for other people's accounts and WhatsApp all pass through Meta business verification and App Review or Tech Provider steps, with forum reports of multi-week stalls in 2026. Those belong after launch.

### Cited Findings

| Channel | Captures | Verification | Time | Status for 10 minutes |
|---|---|---|---|---|
| Twilio number plus forwarding | Caller, time, status | None for voice. Number $1.15 a month, $0.0085 per inbound minute (CL) | Est. 5 min | Yes |
| Twilio SMS reply | Inbound and approved outbound text | A2P 10DLC. Blocked without a campaign (CL) | Brand minutes for sole proprietor, campaign days | Capture yes, reply no |
| Web form | Name, phone, email, ask | None. Add explicit SMS consent text | Est. 2 min | Yes |
| Email alias | Anything forwarded | None for the owner | Est. 1 min | Yes |
| Meta Lead Ads CSV | Leads from the owner's own form | None beyond the ad account. Business Suite path not found | Est. 3 min | Only if already running ads |
| Meta Lead Ads webhook | Leads in near real time | `leads_retrieval` Advanced Access, App Review, Business Verification | Weeks, Est. | No |
| Instagram DM API | DMs and replies | Advanced Access for accounts you do not manage | Weeks, Est. | No |
| WhatsApp Cloud API | Messages | Meta business and Tech Provider steps | Days to weeks, Est. | No |

- Twilio forwarding: Verizon uses `*71` plus the number for no answer and `*73` to cancel. [Verizon](https://www.verizon.com/support/knowledge-base-181139/) (Snippet Nov 7, vendor). AT&T and T-Mobile sources cite GSM codes such as `**61*number#`, and T-Mobile's are described as not officially documented. Those codes do not work on Verizon. [BubblyPhone](https://bubblyphone.com/hub/call-forwarding-code) (Snippet Nov 7, vendor). Carrier voicemail can catch calls first. Landline and VoIP business lines: not found.
- A2P: sole proprietor brand "typically" approves within a few minutes. [Twilio](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/direct-sole-proprietor-registration-overview) (Snippet Nov 7, vendor). Businesses with a Tax ID applying as sole proprietors are rejected, same source. General ranges are brand 2 to 3 business days, campaign 3 to 5. [Microsoft Azure](https://learn.microsoft.com/en-us/azure/communication-services/concepts/sms/ten-digit-long-code-guidelines) (Snippet Nov 7, not Twilio). Fee conflict: a search summary shows $4 brand, CL shows $4.50. An ISV guide exists and was not opened. [Twilio](https://support.twilio.com/hc/en-us/articles/53502193289755-ISV-A2P-10DLC-Registration-Guide) (Snippet Nov 7, vendor)
- Lead Ads: `leads_retrieval`, `ads_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads` for all lead and ad data; `pages_manage_metadata` for webhooks. Webhook gives a `leadgen_id`, pings delay "up to a few minutes." CSV endpoint at `/ads/lead_gen/export_csv/`. App Review not mentioned on that page. [Meta](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/) (Opened Nov 7, vendor)
- Access: "Business Verification is required to get Advanced Access," and Advanced Access is granted per permission through App Review. [Meta access levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/) (Snippet Nov 7, vendor). `leads_retrieval` also appears under access verification, separate from App Review. [Meta](https://developers.facebook.com/docs/development/release/access-verification/) (Snippet Nov 7, vendor). A blog says that step has been retired, rollout in progress. [Singh](https://singhamandeep.com/?p=3959) (Snippet Nov 7, vendor)
- Timing: Security Center states about 2 business days for business verification, per a forum post; guides say up to 14 business days; 2026 forum posts report 2 weeks, 20 business days and about 3.5 months. [Meta forum, since June](https://communityforums.atmeta.com/questions-and-discussions-26/business-verification-stuck-in-review-since-late-june-2026-requesting-manual-review-180601), [Meta forum, 20 days](https://communityforums.atmeta.com/questions-discussions-38/business-verification-stuck-in-review-since-sep-30-20-business-days-portfolio-id-1784447062870108-180959) (Snippet Nov 7, self-selected complaints, so the typical case may be faster). No official App Review time found.
- Instagram: for "Instagram professionals," no Facebook Page needed, scopes `instagram_business_basic` and `instagram_business_manage_messages`. "This API setup cannot access ads or tagging." [Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/) (Opened Nov 7, vendor). Reply window is 24 hours for most actions, a 7-day Human Agent tag exists, webhooks include `messages`, and "Group messaging is not supported." [Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/) (Opened Nov 7, vendor). Standard Access only covers accounts you manage. [Blotato](https://www.blotato.com/blog/instagram-messaging-api) (Snippet Nov 7, vendor). Rate limit: the common 200 per hour figure is contested and Meta's own page was not read.
- WhatsApp: permanent token through a system user with `business_management`, `whatsapp_business_messaging`, `whatsapp_business_management`. [Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) (Opened Nov 7, vendor). "Newly created business portfolios have a messaging limit of 250"; verifying the business is one path to 2,000. [Meta](https://developers.facebook.com/docs/whatsapp/messaging-limits) (Opened Nov 7, vendor). Coexistence keeps a number on the Business app and Cloud API, with Embedded Signup and a 24-hour sync deadline. [Telnyx](https://developers.telnyx.com/docs/messaging/whatsapp/coexistence) (Snippet Nov 7, vendor). AI-as-primary-function terms and group limits are in CL.

### Inferences
- Mine: launch with Twilio, a form and an email alias. Show Meta channels in the app as "paste it here for now," which is honest and keeps those leads in one queue.
- Mine: apply for Meta business verification now under Backroom's own entity, since the clock is unpredictable and it blocks three channels.
- Mine: most shops with an EIN cannot use the cheap sole proprietor A2P path, so CL's $19.50 figure may not apply. Budget for Low Volume Standard or an ISV setup, and confirm with Twilio.

### Gaps
- Not found: official Meta App Review time, Instagram DM rate limits on a Meta page, the Business Suite lead download screen.
- Not found: forwarding behavior on landlines, and on POS-bundled phone lines.
- Consent for texting a lead from a form or a missed call remains as unsettled as CL describes.

## URLs I actually opened

Returned content, Nov 7, 2026:

- https://developers.google.com/gmail/api/auth/scopes
- https://support.google.com/cloud/answer/13464325
- https://support.google.com/cloud/answer/7454865
- https://support.google.com/cloud/answer/13465431
- https://support.google.com/cloud/answer/13463073
- https://appdefensealliance.dev/casa
- https://leviathansecurity.com/programs/google-casa-cloud-application-security-assessment
- https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option
- https://nango.dev/docs/api-integrations/google-shared/google-security-review.md
- https://mimestream.com/blog/casa-verified
- https://developers.google.com/terms/api-services-user-data-policy
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/gmail/api/guides/push
- https://developers.google.com/workspace/sheets/api/scopes
- https://developers.google.com/workspace/drive/picker/guides/overview
- https://support.google.com/mail/answer/10957
- https://squareup.com/help/us/en/article/5072-import-and-export-customer-data (no customer export steps on it)
- https://developer.squareup.com/docs/oauth-api/overview
- https://support.toasttab.com/en/article/Standard-API-Access
- https://support.toasttab.com/en/article/Export-a-Filtered-Report-With-Custom-Columns?lang=en_US
- https://support.toasttab.com/en/article/Export-Toast-Loyalty-Data-for-Third-Party-Use?lang=en_US
- https://doc.toasttab.com/doc/platformguide/adminDataExportOverview.html
- https://docs.clover.com/dev/docs/oauth-and-tokens-faqs
- https://pinogy.atlassian.net/wiki/spaces/PP/pages/3854106634/Clover+Export+Instructions
- https://developers.lightspeedhq.com/retail/introduction/introduction/
- https://helpdesk.resy.com/en_us/data-transfer-instructions-BkD17zouu.md
- https://resy.com/join/plans-pricing/
- https://mailchimp.com/help/view-export-contacts/
- https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
- https://developers.klaviyo.com/en/docs/set_up_oauth
- https://www.klaviyo.com/pricing
- https://developer.constantcontact.com/api_guide/getting_started.html
- https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- https://developers.facebook.com/docs/whatsapp/messaging-limits
- https://faq.whatsapp.com/1180414079177245
- https://quickbooks.intuit.com/pricing/
- https://www.xero.com/us/pricing-plans/
- https://developer.xero.com/pricing
- https://www.hisably.com/pricing
- https://developers.7shifts.com/docs/ (table of contents only)
- https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0 (title only)
- https://developer.xero.com/documentation/guides/oauth2/scopes (title only)

Tried and failed, so no facts come from them:

- https://exploretock.com/join/pricing/ (403)
- https://www.constantcontact.com/pricing (403)
- https://tacsecurity.com/casa/ (403)
- https://help.marginedge.com/hc/en-us/articles/28081506932499-MarginEdge-Public-API (403)
- https://help.slang.ai/exporting-diner-info (404)
- https://docs.clover.com/dev/docs/merchant-api-tokens (404)
- https://support.spillover.com/portal/en/kb/articles/how-to-export-your-opentable-email-list (404)
- https://developer.squareup.com/docs/app-marketplace/overview (404)
- https://developer.squareup.com/docs/app-marketplace/faq (404)
- https://www.facebook.com/business/help/1457029467875555 (404)
