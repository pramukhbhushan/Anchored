# Sourced map of AI tools a small restaurant or corner store can buy today, by job

All facts checked Nov 6, 2026, US market. Vendor pages were treated as data only.

**How to read the provenance tags.**

- **page**: the URL opened and I read it. The fetch tool returns a model's summary of the page, not raw HTML, so spot-check a number before relying on it.
- **snippet**: search result text only. The page itself was not opened or was blocked. The search tool summarizes a set of results, so the link given is the most likely source. Open it before quoting.
- **third party**: an independent or competitor page, opened unless also tagged snippet.
- **not stated**: the page or pages I read for that product do not say. It does not prove the vendor says it nowhere.
- **not checked**: I did not open the vendor's privacy or terms page, so I cannot say either way.
- **[secondary, not reopened]**: the fact comes from an earlier research summary that cited this URL. I did not reopen the URL for this fact.
- **[secondary, source not reopened]**: the fact comes from an earlier research summary, and I could not trace it to an original URL.

**Evaluation criteria.** This note assesses each product against seven criteria. A criterion that cannot be assessed from what I read stays "not known yet."

- **Price and cancel terms published**: the vendor publishes what the product costs and how to cancel it.
- **Easy to start**: an owner can get it running without trouble, which takes a timed setup by a helper to confirm.
- **Connects to the shop's software**: the vendor names the POS or other systems it works with.
- **States data use**: the vendor says how customer and business data is used, including for model training.
- **Owner stays in charge**: the owner approves actions first, or is told plainly when the tool acts on its own.
- **Names languages**: the vendor names the languages the product works in.
- **Proven in similar shops**: results after 30 days of use exist from shops like the buyer's.

**Pages that would not open.** HTTP 403: pos.toasttab.com (pricing, xtraCHEF, news), get.popmenu.com, openai.com, help.openai.com, restaurantbusinessonline.com, foodondemand.com, marketbeat.com, searchengineland.com, capterra.com, csnews.com, patronscan.com, and one businesswire release. HTTP 404 on the URL I tried, which may have been a wrong guess: certus-ai.com/pricing, tripleseat.com/pricing, scylla.ai/pricing, veesion.io/en/pricing, voosh.ai/pricing, loopai.com/pricing, ottimate.com/pricing, owner.com/ai. Rendered empty: 7shifts.com/pricing and clover.com/pricing, which returned a heading or title only. TLS failure: ocurate.com.

**Recent product changes.**

- Square's agent, Managerbot, was free in open beta ([Managerbot release, page](https://squareup.com/us/en/press/managerbot-open-beta)) and has been rebranded Squaremates. Block's Q3 2026 letter says "Managerbot, which we just rebranded to Squaremates" and that it is generally available in the U.S. ([Block Q3 2026 letter, page](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm)). The letter gives no price, so whether it stays free is unknown.
- As of Nov 6, 2026, BentoBox is for Clover POS customers only and is no longer open to any restaurant. Its page says products are "only available to Clover POS customers" ([BentoBox, page](https://www.getbento.com/pricing/)).
- As of Nov 6, 2026, Loop's old domain tryloop.ai redirects to loopai.com, whose home page describes finance, marketing and operations agents and does not mention chargeback recovery ([Loop, page](https://www.loopai.com/)).

## What real products exist for each restaurant job, and do their facts meet the evaluation criteria?

### Takeaway

Every restaurant job has several live products, and phones are the most crowded with 9. Published price plus published cancel terms is the exception: of the dedicated phone tools only Certus clears both on the vendor page. Among the pages I read, only Square and Anthropic say whether customer data trains models, so "states data use" is the criterion most products would fail or leave unknown.

### Cited Findings

#### Answering phones, orders and reservations

| Product | Price | Cancel terms | Connections | Languages | Human approval | Data terms | Source |
|---|---|---|---|---|---|---|---|
| Slang | Core from $399, Premium from $599, per location; Enterprise custom | not stated | Reservations: OpenTable, SevenRooms, Yelp, Resy. Events: Tripleseat, Perfect Venue. POS: not stated | Spanish bilingual, the page conflicts on whether Core includes it. Premium names 97 languages | not stated | Recordings may be shared with service providers and advertising, analytics and business partners. No mention of AI or model training ([privacy, page](https://www.slang.ai/privacy-policy)) | [page](https://www.slang.ai/pricing) |
| Maple | Voice $85/mo yearly or $150 monthly. Pro $220/mo yearly or $350 monthly | "No complicated contracts"; term and notice not stated | Toast, Square, Clover, Shift4 Dine; OpenTable | "Multilingual voice," languages not named | not stated | No statement on call data, AI training or retention ([privacy, page](https://www.maple.inc/privacy)) | [page](https://www.maple.inc/pricing) |
| Certus | $250/mo for ordering, no setup fee | "No Contract," monthly billing; minimum term not stated | Toast, Square, Clover, SkyTab; OpenTable | Spanish included; others not stated | not stated | not checked | [page](https://www.certus-ai.com/) |
| Loman | Not stated, "Request Pricing." Page says "No per minute fees"; a roundup says from $249/mo plus $0.15 per minute ([snippet](https://aibunny.tech/best-ai-phone-agent-for-restaurants/)), which conflicts | not stated | Toast, SpotOn, Clover, Shift4, Square, Aloha, Olo, Stream; OpenTable, Resy | not stated | not stated | not checked, privacy URL tried returned 404 | [page](https://www.loman.ai/pricing) |
| Hostie | Tiers named, prices not stated | not stated | Reservations and POS not named; a testimonial names Perfect Venue | 20 languages on Premium, list not stated | not stated | not checked | [page](https://www.hostie.ai/pricing) |
| VOICEplug | not stated, mentions a "fixed monthly cost" | not stated | 80+ POS claimed, including Toast, Square, Clover, Aloha, FoodTec, Qu | not stated | not stated | not stated on home page | [page](https://www.voiceplug.ai/) |
| Yelp Host | From $249/mo, or $199 for Guest Manager customers (July 2026), up from $149 in Oct 2025 ([snippet](https://www.businesswire.com/news/home/20260728926260/en/)) | not stated | OpenTable added ([snippet](https://ppc.land/yelp-host-adds-opentable-as-call-volume-gains-38-a-month-since-launch/)) | Only competitor claims, which conflict at 5 and 8 ([snippet](https://hostie.ai/resources/hostie-ai-vs-yelp-host-2025-restaurant-call-management-comparison)) | not stated | not checked | snippet |
| Popmenu AI Answering | Conflicting: $150, $200 or $349/mo add-on ([Restolabs, snippet](https://www.restolabs.com/blog/popmenu-pricing), [SwipeBy, snippet](https://swipebyreviews.pages.dev/compare/swipeby-vs-popmenu.html)). PricingSaaS says the $149 callout came off the page ([snippet](https://pricingsaas.com/companies/popmenu)) | Contract length not published (snippet) | not stated | not stated | not stated | not checked | snippet, vendor page blocked |
| Square voice ordering | No separate fee found; a blog says the plan is the known cost and the feature is marked beta ([snippet](https://sagnikbhattacharya.com/blog/restaurants-square-ai-voice-ordering-setup-test)). Square lists "automated voice ordering and messaging" ([Square AI, page](https://squareup.com/us/en/ai)) | "Cancel or switch anytime" ([page](https://squareup.com/us/en/pricing)) | Square only | not stated | not stated | See Square row under built-in AI | page and snippet |
| Owner AI phone | Waitlist, price not stated | n/a | not stated | not stated | not stated | not checked | [page](https://www.owner.com/ai-phone-ordering) |
| Toast | Voice appears only inside Toast Drive-Thru, rolling out first to brands with 15+ locations. The article shows no standalone phone agent | n/a | Toast only | n/a | n/a | not checked | [Toast Spring 26 release, page](https://support.toasttab.com/en/article/Everything-Toast-announced-in-our-Spring-26-Release) |

Square's voice kiosk is a separate product at $1,999 with a stand, plus $99 per device per month, and needs Square Plus at $49 per location per month or Premium at $149 ([Square, page](https://squareup.com/us/en/press/square-kiosk-self-service-reimagined)).

#### Invoices and food cost

| Product | Price | Cancel terms | Connections | Languages | Data terms | Source |
|---|---|---|---|---|---|---|
| MarginEdge | $350 per location/mo, 10% off annual. Onboarding fees excluded, amount not stated | Monthly has no stated term or cancel fee. Annual is 12 months and the balance stays due if cancelled | Only Toast named. Toast users pay a 10% API pass-through plus $50 per location/mo for Toast's management suite | not stated | not checked | [page](https://www.marginedge.com/pricing) |
| MarketMan | Starter $249/mo, 50 invoice scans. Growth $299/mo, unlimited scans and AI recipe optimization. Enterprise from $449. Per-location terms not stated | Linked agreement not read | Square, Toast, Lightspeed, Clover | not stated | not checked | [page](https://www.marketman.com/pricing) |
| xtraCHEF by Toast | Directories say from $149/mo; Capterra says per location by invoice count; another says custom. Vendor not confirmed ([Softabase, snippet](https://softabase.com/software/restaurant-management/xtrachef), [PulseSignal, snippet](https://getpulsesignal.com/compare/toast-vs-xtrachef)) | not stated | Third party says it works with non-Toast POS (snippet) | not stated | not checked | snippet, vendor blocked |
| Restaurant365 | "Get a Custom Quote" | not stated | POS named generically | not stated | not checked | [page](https://www.restaurant365.com/pricing/) |
| Ottimate | not stated | not stated | Dynamics, Sage Intacct, Acumatica, NetSuite, QuickBooks. Page aims at multi-location finance staff | not stated | not checked | [page](https://ottimate.com/) |

#### Scheduling and staff messages

| Product | Price | Cancel terms | Connections | AI | Languages | Source |
|---|---|---|---|---|---|---|
| Homebase | Basic $0 for one location up to 10 staff. Essentials $30, Plus $70, All-in-One $120 per location/mo. 20% annual badge | "Changed or cancelled at any time" | POS included, systems not named | AI Scheduling Assistant on Plus. Hiring Assistant from $99/mo | not stated | [page](https://www.joinhomebase.com/pricing) |
| 7shifts | Free for one location up to 15 staff. Essentials $39.99, Pro $79.99, Premium $134.99 per location/mo on annual, per one read. Other sources differ ([snippet](https://www.aimadefor.com/blog/7shifts-pricing-2026/), [snippet](https://costbench.com/software/employee-scheduling/7shifts/free-plan/)). Entrée and The Works were renamed in 2025 ([snippet](https://www.noon.ai/blog/articles/452-7shifts-pricing-2026)) | not stated | not stated | not stated | not stated | snippet, vendor page rendered empty |
| Sling | Free to 30 users. Premium $2, Business $4 per user/mo. Page says Sling is now part of Toast | Term and cancel not stated | not stated | "Auto-assigning," not called AI | not stated | [page](https://getsling.com/pricing/) |
| When I Work | $2.50, $5, $8 per user/mo, 14-day trial. FAQ and plan table conflict on what $2.50 covers | "No contracts or hidden fees" | Payroll and POS listed, systems not named | Auto scheduling, not called AI | not stated | [page](https://wheniwork.com/pricing) |

- Squaremates, formerly Managerbot, drafts staff schedules, and the Managerbot release says schedules need seller review before they go live ([Square, page](https://squareup.com/us/en/press/managerbot-open-beta)).
- Group chat copilots: one search found no product that sits inside an existing staff group chat. It found bots that replace the chat, such as a call-in line for swaps ([Whippy, snippet](https://www.whippy.ai/blog/ai-restaurant-shift-scheduling-with-call-in)), a build-it-yourself WhatsApp flow ([Pabbly, snippet](https://www.pabbly.com/automate-staff-scheduling-for-restaurants-via-whatsapp-with-pabbly-chatflow/)) and a general WhatsApp assistant ([Cloneify, snippet](https://cloneify-website.pages.dev/use-cases/restaurants)).

#### Reviews and reputation

| Product | Price | Terms | Human approval | Source |
|---|---|---|---|---|
| Google Business Profile, built-in | Replying is available to verified businesses. Google reviews each reply before posting, usually within 10 minutes and up to 30 days | n/a | Owner types and submits | [Google help, page](https://support.google.com/business/answer/3474050) |
| GBP "Reply to reviews with AI" | Test seen by only some businesses, spotted as of March 2026. No Google announcement found | n/a | Conflicting. SE Roundtable does not describe approval ([page](https://www.seroundtable.com/google-reply-to-reviews-with-al-41095.html)). Testers report both manual submit and more automated flows ([Search Engine Land, snippet](https://searchengineland.com/google-business-profile-test-reply-to-reviews-with-ai-472167)) | page and snippet |
| Marqii | Base $90, Growth $145, Scale $180 with AI suggestions, Package $250, per location/mo | "Based on annual contract"; length and cancel not stated | Scale suggests replies "for you to approve." Package sends 100 third-party replies automatically | [page](https://marqii.com/pricing) |
| Birdeye | Quote form only, location counts from 1 to 3 | "One platform, one contract," term not stated | not stated | [page](https://www.birdeye.com/pricing/) |
| Podium | Sales only. "Add on AI Employee to any plan," price not stated | not stated | not stated | [page](https://www.podium.com/pricing/) |
| Ovation | $99 per user/mo in directories, aimed at multi-unit | not stated | not stated | [GetApp, snippet](https://www.getapp.com/all-software/a/ovation/) |
| Momos | Price not listed on its own roundup | not stated | not stated | [Momos, page, vendor author](https://www.momos.com/blog/best-ai-agents-for-restaurant-operations) |

Limit to keep in mind: Google's terms, read conservatively, bar feeding Google Places reviews to a model, since they name improving models and creating content from Maps content, and `connectors_and_limits.md` covers how an owner's own Business Profile reviews differ ([Google Maps Platform terms](https://cloud.google.com/maps-platform/terms), [secondary, not reopened]). An agent that drafts replies needs the owner to supply the review text.

#### Marketing and the website

| Product | Price | Cancel terms | Approval | Source |
|---|---|---|---|---|
| Owner | Flex $249/mo plus 5% restaurant fee per order. Flat $499/mo. Guests pay a 5% order support fee on both | "Month-to-month with no long-term contracts" | not stated on pricing page or in funding coverage | [page](https://www.owner.com/pricing), [Pulse 2, page](https://pulse2.com/owner-raises-240-million-at-2-3-billion-valuation-as-arr-tops-100-million/amp/) |
| Square Marketing | Needs Plus ($49) or Premium ($149). Plus: 500 texts then 3 cents each. Premium: 2,500 then 1.5 cents | "Cancel or switch plans anytime" | Page does not state; the Managerbot release says marketing content needs seller review | [page](https://squareup.com/us/en/marketing), [page](https://squareup.com/us/en/press/managerbot-open-beta) |
| Toast IQ Grow | $499/mo with a human Marketing Success Manager ([Pulse 2, page](https://pulse2.com/toast-iq-grow/?noamp=mobile)). Toast's own release figure was not visible; vendor page blocked | not stated | not stated | third party |
| Popmenu | Starter $179, Essentials $299, Premier $499/mo; onboarding about $1,300 per a competitor ([Restolabs, snippet](https://www.restolabs.com/blog/popmenu-pricing)) | Confirmed in sales process (snippet) | not stated | snippet |
| SpotOn Marketing Assist | Core Bundle $50/mo plus 20 bps of volume, capped at $200 per location | Contract not stated | not stated | [page](https://www.spoton.com/pricing/) |
| BentoBox | Clover POS customers only, price not stated | not stated | not stated | [page](https://www.getbento.com/pricing/) |

#### Catering and event inquiries

| Product | Price | Cancel terms | AI and approval | Source |
|---|---|---|---|---|
| Perfect Venue | Free plan. Professional $199 annual or $239 monthly, Premium $299 or $339, per location. 14-day trial, no card. Card fees apply | 30-day money-back; term not stated | AI Reply writes emails. Approval, data terms and tier not stated ([page](https://www.perfectvenue.com/ai-reply)) | [page](https://www.perfectvenue.com/pricing) |
| ezCater | Free to list, no contract, 15% commission plus 2.99% payment fee per its help center | No contract | None found | [selling fees, snippet](https://www.ezcater.com/company/grow-catering-business/selling-fees/) |
| Tripleseat | No public price. Directories conflict: $99/mo ([Software Advice, snippet](https://www.softwareadvice.com/event-management/tripleseat-profile)), $400/mo ([HotelTechReport, snippet](https://hoteltechreport.com/zh/compare/meetingpackage-event-operations-vs-tripleseat)) | Annual typical per a directory (snippet) | No AI lead product confirmed | snippet |
| Kutlerri Catering Sales Agent | No subscription, fee is a share of outcomes, "There is no one rate" | not stated | "You approve the quotes," with a human sales team behind the agent | [page](https://kutlerri.ai/) |
| Toast IQ Catering | Needs the Catering & Events module, price not stated | not stated | Checks configuration only per article | [page](https://support.toasttab.com/en/article/Everything-Toast-announced-in-our-Spring-26-Release) |

#### Delivery disputes and commission recovery

| Product | Price | Terms | Who it serves | Source |
|---|---|---|---|---|
| Voosh | not stated. A 2023 headline on its site mentions a free 30-day trial | not stated | Case studies are 28 to 200+ location groups. A profile says 20 to 30 location brands ([snippet](https://informaconnect.com/fstec/sponsors/voosh/)). Covers DoorDash, Uber Eats, Grubhub, ezCater. Has auto-reply for reviews | [page](https://www.voosh.ai/) |
| Orders.co | $29/mo billed annually, a special offer for under 2,500 online orders a year. Other tiers not stated | Not stated. Automated resolution is a premium upgrade | Small operators. Vendor claims about 90% dispute success | [page](https://orders.co/restaurant-dispute-management-assistant) |
| Loop | not stated | not stated | More than 300 brands per funding coverage ([snippet](https://techstory.in/loop-ai-raises-14-mn-to-untangle-restaurants-delivery-complexity/)). Target customer not stated on home page | [page](https://www.loopai.com/) |
| Deliverect Resolve | not stated. Vendor claims 95% refund capture | not stated | Self-described enterprise | [snippet](https://www.deliverect.com/resolve-by-deliverect) |
| Lunchbox Dispute Manager | Claims $150 per location per month saved | not stated | Mid-market to enterprise | [snippet](https://info.lunchbox.io/dispute-manager) |
| DTiQ SmartDispute | not stated | not stated | not stated | [snippet](https://dtiq.com/solutions/smartdispute) |
| Ocurate | Could not verify it exists. ocurate.com failed TLS and two searches found nothing | | | No source found |

#### Built-in AI from the POS

| Product | What the owner gets | Price | Approval | Data and language | Source |
|---|---|---|---|---|---|
| Squaremates, was Managerbot and Square AI | Sales and labor monitoring, inventory alerts, schedule drafts, campaign suggestions, catalog cleanup, purchase orders for food sellers. Procurement agents planned | Managerbot beta was "at no additional cost." Squaremates price not stated | "Managerbot proposes an action, and sellers approve" | Square says sensitive data never goes to model providers and third parties do not use data "for any type of training." Languages not stated | [Managerbot, page](https://squareup.com/us/en/press/managerbot-open-beta), [Q3 letter, page](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm), [Square AI beta, page](https://squareup.com/us/en/press/square-ai-open-beta) |
| Toast IQ | Translation and Menu Upsells are available to all Toast POS users. Marketing Agent needs Grow. Multi-location analysis for groups. Toast IQ is included with Toast POS ([Spring 26 release](https://support.toasttab.com/en/article/Everything-Toast-announced-in-our-Spring-26-Release), [secondary, not reopened]) | Price of included features not stated; Grow $499 third party | Not stated | Replies in Spanish, Chinese, Korean "or another language"; no full list. Data terms not checked | [Spring 26 release, page](https://support.toasttab.com/en/article/Everything-Toast-announced-in-our-Spring-26-Release) |
| SpotOn | Profit Assist scans a P&L for savings. AI menu assistant named only | POS Essentials $55/station with month-to-month. All-In $0/station with a 2-year minimum. Core Bundle above | not stated | not stated | [page](https://www.spoton.com/pricing/) |
| Clover | No official source found on AI features. The only description of "Clover Assistant" came from a low-quality page ([snippet](https://spice.alibaba.com/spice-basics/clover-assistant)). Clover Reserve with Tabit launched May 12, 2026 for fine dining ([snippet](https://briefglance.com/companies/fiserv-inc/pulses/17044)) | Counter Service $59.95, Table Service $89.95, per an article updated Nov 2025 | not stated | not stated | [Merchant Maverick, third party](https://www.merchantmaverick.com/clover-pos-cost) |

Clover contract warning: the same article says software requires a 36 or 48 month contract with an early termination fee equal to the remaining balance. A Clover first-party page could not be read to confirm this ([Merchant Maverick, third party](https://www.merchantmaverick.com/clover-pos-cost)).

### Inferences

- Phone tools answer callers live, so "owner approves first" cannot apply to the voice itself. They meet "owner stays in charge" only if the buyer is told plainly that the tool "answers customers on its own."
- For a Square shop, Square's own features overlap with phone, marketing and schedule drafting. For a Toast shop, marketing is covered and phones are not. For Clover, third-party tools that connect to the POS do most of the work, since Maple, Certus and Loman each name Clover and I could not confirm Clover's own AI.

### Gaps

- No vendor page gave setup time, so "easy to start" stays "not known yet" for every product. Maple Pro names "white-glove onboarding" only.
- No product has results after 30 days of use in this map, so "proven in similar shops" stays "not known yet."
- Data terms: I opened privacy pages for Slang and Maple only among phone vendors, and neither mentions model training. Everything marked "not checked" needs a read.
- Toast's price sheet, xtraCHEF, Popmenu and Tripleseat vendor pages could not be confirmed. A person with a browser should check them.

## What real products exist for each corner store job, and do their facts meet the evaluation criteria?

### Takeaway

Operating software for corner stores is well stocked and often cheap, with NRS from $19.95/mo and Hisably at $30/mo. AI inside it is thin and mostly invoice capture. Camera AI has no published price at any vendor I could read, and manufacturer programs are contracts, not products.

### Cited Findings

#### POS reorder and inventory

| Product | Price | Contract | AI | Languages | Source |
|---|---|---|---|---|---|
| NRS | Basic $19.95 with NRS Pay, $29.95 without. Pro $34.95 or $54.95. Advanced $49.95 or $74.95. Elite $79.95 or $109.95. Hardware from $0 on your own Android tablet up to $1,799 | "Contract required." Prepayments non-refundable. $350 per device if not returned. Term length not stated | AI Product Recommendations on Elite, add-on price not stated | Website only: English, French, Spanish, Hindi, Arabic. POS not stated | [page](https://www.nrsplus.com/pricing) |
| Modisoft | Plus $69, Advanced $89/mo with lottery, fuel and tobacco scan data. 30-day trial, no setup fee | Early termination fee applies, amount not stated, term not stated | AI invoice reader announced Sept 2025, price and availability not stated ([NACS, page](https://www.convenience.org/stay-current/news/2025/september/18/2-using-ai-to-cut-through-busy-work_tech)) | not stated | [page](https://www.modisoft.com/pricing) |
| Square for Retail | Plus $49 per location ([page](https://squareup.com/us/en/press/square-kiosk-self-service-reimagined)). Plus adds inventory, vendor and purchase orders, COGS reports. Low-stock alerts listed | "Cancel or switch anytime" | Squaremates, see above. Reorder is alerts and purchase orders; no automatic reorder claim seen | not stated | [page](https://squareup.com/us/en/point-of-sale/retail/pricing) |
| Lightspeed Retail | Basic $89, Core $149, Plus $289/mo; billing period unclear | not stated | AI Doc Import turns an invoice scan into draft POs, add-on on Basic and Core | not stated | [page](https://www.lightspeedhq.com/pos/retail/pricing/) |
| Clover | Essentials $14.95, Retail Growth $84.95/mo | 36 or 48 month per third party | No official source found | not stated | [Merchant Maverick, third party](https://www.merchantmaverick.com/clover-pos-cost) |
| Toast Retail with Toast IQ for Retail | Purchase through Toast Shop, price not stated | not stated | Answers from store data. AI Invoice Scanning in beta, by sign-up form | Toast IQ replies in the asker's language | [page](https://support.toasttab.com/en/article/Everything-Toast-announced-in-our-Spring-26-Release) |
| FTx POS | "Starting at $0"; ecommerce add-on $0.99/mo plus 2% fee | not stated | not stated | not stated | [page](https://goftx.com/scan-data/) |

Computer vision for shelves: I found no shipping product with a price for a single store. Smartshelf is an Android open beta described as very early ([snippet](https://hunted.space/product/smartshelf)). OmniShelf says it serves small-format retailers, with price and phone use not stated ([snippet](https://builtin.com/company/omnishelf)). Trax has a mobile shelf service aimed at larger programs ([snippet](https://traxretail.com/?p=13500)). PAR Retail Drive AI launched March 3, 2026 for convenience and fuel, with humans kept in for critical checks on offers. Independents are not mentioned ([Business Wire, snippet](https://www.businesswire.com/news/home/20260303574408/en/PAR-Technology-Launches-PAR-Retail-Drive-AI-The-Intelligence-Layer-Transforming-Convenience-and-Fuel-Retail)).

#### Distributor ordering and invoice reconciliation

| Product | Price | Who can use it | Notes | Source |
|---|---|---|---|---|
| McLane Grocery Ordering app | Price not stated | McLane customers, access through a representative. First-order promo needs a $200 minimum. Standing minimum not found | Ordering, no AI seen | [McLane, snippet](https://go.mclaneco.com/independent), [app, snippet](https://apps.apple.com/us/app/-/id954376930) |
| Core-Mark CustomerFirst | Price not stated | Core-Mark customers | Curated suggestions and order guides. Only AI evidence is an app note on AI-generated descriptions | [app, snippet](https://apps.apple.com/us/app/core-mark-customerfirst/id6740543539) |
| Hisably | $30/mo, plus $15/mo Cloud Document Management with "AI-powered data capture" for invoices. 14-day trial, no card | C-stores, liquor stores and gas stations in the USA | Cancel anytime, no contract. POS and languages not stated | [page](https://www.hisably.com/pricing) |
| Petrosoft Retail360 | Free app | Not stated | Scans items to enter vendor invoices, Smart Price Book from a UPC database. POS needs and AI not stated | [page](https://petrosoftinc.com/blog-news/retail-360-overview/) |
| CoreVue | Free per iOS listing | Not stated | AI invoice recognition, multi-site price book | [app, snippet](https://apps.apple.com/app/corevue/id1610169477) |
| ItScans-AI | From $59.95/mo per Capterra | Convenience and petroleum retailers | Trained on vendor invoice formats, alerts on cost changes upon scan | [Capterra, snippet](https://www.capterra.com/p/246569/ItScans-AI/) |
| Lightspeed AI Doc Import, Modisoft reader, Toast beta | See above | | | |

I did not find any product that checks a scanned invoice against the deal sheet, promotion or allowance the store was promised. Tools advertise capture and cost-change alerts only.

#### Price book, margin and manufacturer scan programs

- **Altria Digital Trade Program.** Tier 1 requires weekly transaction-level scan data and pays a base incentive per transaction. Tier 2 adds a retailer digital platform for 21+ customers, age verification and digital coupons. Tier 3 pays a flat per-store amount ([Skupos help, snippet](https://help.skupos.com/en/articles/9465516-altria-s-digital-trade-program-dtp-overview)). The help page now redirects, so I could not open it.
- A 2020 AGDC guide says approval "does not guarantee" payment and data must be transaction level with no aggregation ([AGDC, snippet](https://www.storetenderonline.com/wp-content/uploads/2020-02-20-AGDC-2020-Scan-Reporting-Requirements.pdf)). It may be outdated.
- A POS vendor says 2026 added Tier 4 and EAIV requirements. I did not verify this against Altria ([FTx, snippet](https://goftx.com/news/altria-scan-data-update-2026/)).
- **RJ Reynolds.** I found no primary source. POS vendors say tobacco companies reject raw exports and need a certified provider ([Lifelong POS, snippet](https://www.lifelongpos.com/resources/blog/tobacco-manufacturer-rebates-pos-scan-data)), that unpropagated returns risk audit clawbacks (same source), and one illustrates a $30/mo provider fee (same source).
- **Sellers of the plumbing.** Modisoft Advanced at $89 includes it ([page](https://www.modisoft.com/pricing)). NRS lists Tobacco Scan Data, price not stated ([page](https://www.nrsplus.com/pricing)). PDI Essentials connects to Gilbarco, Verifone and NCR, price not stated, with scan data moving to Skupos ([page](https://www.pdiessentials.com/)). FTx names Altria only, price not stated, and says "Retailers must have a compatible POS system" ([page](https://goftx.com/scan-data/)).
- **Price books.** NRS includes pricebook and inventory on all plans ([page](https://www.nrsplus.com/pricing)). Modisoft sells a Data Entry add-on at $49 or $149, not described ([page](https://www.modisoft.com/pricing)). Scanning Solutions custom-builds price books as a service ([snippet](https://scanningsolutions.com)).
- None of these sources describes AI in price book or scan data work.

#### Age verification, loss prevention and camera AI

| Product | Honest price | Contract | Source |
|---|---|---|---|
| Veesion | No list price. A store paid "a couple hundred dollars a month" for 24 cameras per a March 2024 news story, on existing cameras. No measured theft reduction reported | Subscription, terms not stated | [NBC Boston, third party](https://nbcboston.com/investigations/consumer/ai-is-helping-small-businesses-stop-shoplifting-in-their-stores/3314063/), [RFP Wiki, snippet](https://www.rfp.wiki/vendors/veesion) |
| Scylla | No price found | not stated | Search found none |
| Solink | "Customized," book a meeting | not stated | [page](https://solink.com/pricing/) |
| Spot AI | Quote based. About $99 per camera/mo is a third-party planning figure. Page offers cameras "at no cost," conditions not stated | Monthly, annual, multi-year per third party | [page](https://www.spot.ai/pricing), [Safe and Sound, snippet](https://getsafeandsound.com/blog/spot-ai-pricing/) |
| Verkada | Quote per camera | not stated | [Vendr, snippet](https://www.vendr.com/marketplace/verkada) |
| NRS Pro and Advanced | License ID scanning and camera integration on Pro from $34.95. Anti-Theft Alerts on Advanced from $49.95. Separate camera equipment required | Contract required | [page](https://www.nrsplus.com/pricing) |
| TokenWorks | AgeVisor POS scanner $695 at an introductory sale, IDStand $1,295 at an introductory price | One-time | [TokenWorks, snippet](https://www.idscanner.com/news/tokenworks-releases-windows-point-of-sale-age-verification-platform), [snippet](https://idscanner.com/product/agevisor-3) |
| IDScan VeriScan | Flat monthly or annual rate, no figure | not stated | [app, snippet](https://apps.apple.com/app/id492004415) |
| Patronscan | $49/mo plus $0.25 per scan is its online Shopify gate, not a store scanner. Store price not found, page blocked | not stated | [Shopify, snippet](https://apps.shopify.com/ps-verify-ts) |

#### Delivery marketplaces and digital presence

- **DoorDash.** Basic 15%, Plus 25%, Premier 30% delivery, 6% pickup. "No contract" and "Change or cancel any time." Convenience stores are listed as a business type with no separate rates ([page](https://merchants.doordash.com/en-us/products/pricing)). A DoorDash convenience page lists the same rates, but pages conflict on which plan carries the 20-order guarantee ([search, snippet](https://merchants.doordash.com/en-us/products)).
- **Uber Eats.** Lite 20% since March 2026, Plus 25%, Premium 30%, per trade coverage about restaurants ([Food On Demand, snippet](https://foodondemand.com/04012026/how-the-uber-eats-fees-stack-up-against-3pd-competitors/)). Retail rates not found.
- **Grubhub.** 5%, 15%, 20% marketing tiers plus 10% for its delivery, same source and same limit.
- **Instacart.** No fee terms for an independent store found.
- **Store-owned channels.** NRS includes ecommerce on Advanced ([page](https://www.nrsplus.com/pricing)). NRS's BR Club app offers pickup or delivery ordering ([CSP, snippet](https://www.cspdailynews.com/technologyservices/national-retail-solutions-teams-core-mark)). FTx Commerce above.
- **Google Business Profile.** Same as the restaurant row. I found no store-specific AI for it.

#### Generic tools

- **Claude.** Free $0. Pro $17/mo annual or $20 monthly. Team from $20 per seat annual. Free and Pro training is opt-out, Team is off by default ([pricing, page](https://www.claude.com/pricing)). Consumer chats train only if you allow it, plus flagged chats, and Incognito chats are excluded ([privacy, page](https://privacy.claude.com/en/articles/10023580-is-my-data-used-for-model-training)).
- **ChatGPT.** Pricing and data help pages were blocked, so facts are not confirmed here. Read them before relying on them.
- **Google Translate camera.** Works from a phone camera and offline after downloading a language. Cost and language list not stated on the help page ([page](https://support.google.com/translate/answer/6142483)).

### Inferences

- For a corner store, turning on a feature of software it already has often means a paid tier change, not a free switch. NRS's AI, anti-theft and ID features sit behind plan tiers, on a required contract.
- An owner with a free assistant and a phone camera can approximate shelf checks and invoice reading with no integration. That fits buying nothing new, or using what the store already has, better than a custom build, but I found no measured accuracy for this use.

### Gaps

- Shelf and reorder accuracy of any tool: no independent test found.
- McLane and Core-Mark standing minimums and terms: not public in what I read.
- Actual dollars an independent store earns from Altria or RJR programs: vendor pages decline to give a figure ("Incentives may differ," [FTx, page](https://goftx.com/scan-data/)).

## For corner stores, is the market empty or poorly served compared with restaurants?

### Takeaway

Not empty, poorly served for AI. I counted about 45 restaurant products and 39 corner store products by job, but only 14 of the corner store products carry AI on the job versus 29 for restaurants. Apart from Square's and Toast's general agents, none of those 14 drafts anything a customer or supplier sees. This is a lower bound from one session, not a census.

### Cited Findings

Rules for the count: a shipping US product, seen on a vendor page or primary release, or in a snippet where noted in the sections above. Excludes waitlists and concept pages. A product can count in more than one job. "AI on the job" means the page or a cited source names AI doing that job. "Price on vendor page" means I read the number there. All sources are in the two sections above.

| Vertical and job | Serious products | AI on the job | Price on vendor page |
|---|---|---|---|
| R: phones | 9: Slang, Loman, Maple, Hostie, Certus, VOICEplug, Yelp Host, Popmenu, Square | 9 | 3: Slang, Maple, Certus |
| R: invoices, food cost | 5: MarginEdge, xtraCHEF, R365, MarketMan, Ottimate | 1: MarketMan | 2: MarginEdge, MarketMan |
| R: scheduling, messages | 5: 7shifts, Homebase, Sling, When I Work, Squaremates | 2: Homebase, Squaremates | 3: Homebase, Sling, When I Work |
| R: reviews | 6: GBP test, Marqii, Birdeye, Podium, Ovation, Momos | 4: GBP test, Marqii, Ovation, Momos | 1: Marqii |
| R: marketing, website | 6: Owner, Square Marketing, Toast IQ Grow, Popmenu, SpotOn, BentoBox | 3: Owner, Toast IQ Grow, SpotOn | 3: Owner, Square Marketing, SpotOn |
| R: catering | 5: Perfect Venue, ezCater, Tripleseat, Kutlerri, Toast Catering | 3: Perfect Venue, Kutlerri, Toast IQ Catering | 1: Perfect Venue |
| R: delivery recovery | 6: Voosh, Orders.co, Loop, Deliverect, Lunchbox, DTiQ | 4: Voosh, Orders.co, Loop, Deliverect | 1: Orders.co promo |
| R: built-in | 3 confirmed: Toast IQ, Squaremates, SpotOn | 3 | 1: SpotOn |
| **Restaurant total** | **45** | **29** | **15** |
| C: POS, inventory | 7: NRS, Modisoft, Square, Lightspeed, Clover, Toast Retail, FTx | 3: NRS, Toast IQ, Squaremates | 3: NRS, Modisoft, Lightspeed |
| C: distributor, invoices | 9: McLane, Core-Mark, Hisably, Retail360, CoreVue, ItScans-AI, Modisoft reader, Lightspeed Doc Import, Toast beta | 6: Hisably, CoreVue, ItScans-AI, Modisoft, Lightspeed, Toast beta | 3: Hisably, Retail360, Lightspeed |
| C: price book, scan data | 6: NRS, Modisoft, FTx, PDI Essentials, Petrosoft, Scanning Solutions | 0 | 2: NRS, Modisoft |
| C: age, loss, cameras | 9: Veesion, Scylla, Solink, Spot AI, Verkada, NRS, TokenWorks, IDScan, Patronscan | 5: the camera vendors, none with a list price | 1: NRS |
| C: delivery, presence | 8: DoorDash, Uber Eats, Grubhub, Instacart, GBP, NRS ecommerce, BR Club, FTx Commerce | 0 | 3: DoorDash, NRS, FTx |
| **Corner store total** | **39** | **14** | **12** |

Other evidence for "poorly served":

- No corner-store-specific product I found answers a store's phone, writes to a distributor, drafts a review reply or explains a scan-data tier. Restaurant vendors are active on the phone and review jobs. Square's general agent and Google's test could reach a store on those platforms.
- Language: no corner store product page I read names a language for the product. NRS names website languages only ([page](https://www.nrsplus.com/pricing)). Toast IQ's translation is the only named owner-facing language feature, and it needs Toast Retail ([page](https://support.toasttab.com/en/article/Everything-Toast-announced-in-our-Spring-26-Release)).
- Scale of attention: PAR, the one named AI suite for convenience retail, sells on its unified platform and does not mention independents ([snippet](https://www.businesswire.com/news/home/20260303574408/en/PAR-Technology-Launches-PAR-Retail-Drive-AI-The-Intelligence-Layer-Transforming-Convenience-and-Fuel-Retail)).

### Inferences

- The real corner store shape is "plenty of operating software, little AI that does work." That suggests that, compared with restaurants, stores will have few options for turning on a feature they already have or connecting a third-party tool, and buying nothing will often be the right call.
- Because many of the 39 are chain, camera or marketplace products, the count overstates what a one-store owner can act on.

### Gaps

- I ran fewer independent-review checks for corner store products than for restaurants, because trade coverage is thinner and csnews.com blocked. The difference in AI counts could shrink with more search.
- I did not find a count of independent stores using any of these tools.

## Which products can a one-store owner buy without a sales call and a contract?

### Takeaway

About a dozen products publish a price and a no-contract or cancel-anytime line. Everything in camera AI, most review suites and most delivery recovery is quote-only. "Published price" does not prove there is no sales call, so I marked signup evidence separately.

### Cited Findings

**Published price, explicit no-contract or cancel-anytime, and a free tier or trial stated on the page.**

- Homebase: $0 for one location up to 10 staff, 14-day trial with no card. Per location ([page](https://www.joinhomebase.com/pricing)).
- When I Work: 14-day trial, "no contracts," per user ([page](https://wheniwork.com/pricing)).
- Hisably: 14-day trial with no card, cancel anytime ([page](https://www.hisably.com/pricing)).
- Square Free, Plus at $49 per location and Premium at $149: "Cancel or switch anytime" ([page](https://squareup.com/us/en/pricing), [page](https://squareup.com/us/en/press/square-kiosk-self-service-reimagined)). Trial length not rendered on page.
- DoorDash: "No contract. No fixed cost" ([page](https://merchants.doordash.com/en-us/products/pricing)).
- Claude: Free or $20 monthly ([page](https://www.claude.com/pricing)).

**Published price and no-contract line, signup path not confirmed.**

- Certus: $250/mo, "No Contract," monthly ([page](https://www.certus-ai.com/)).
- Owner: $249 or $499, month-to-month ([page](https://www.owner.com/pricing)).
- MarginEdge: $350 per location monthly with no cancel fee. Onboarding fee amount not stated, Toast users pay extra ([page](https://www.marginedge.com/pricing)).
- SpotOn POS Essentials: $55 per station, month-to-month, hardware and implementation extra ([page](https://www.spoton.com/pricing/)).

**Published price, cancel terms unclear.**

- Maple: "No complicated contracts," yearly billing shown as the lower price ([page](https://www.maple.inc/pricing)).
- Slang: "starting at," per location ([page](https://www.slang.ai/pricing)).
- Perfect Venue: free plan, 14-day trial, 30-day money back, per location ([page](https://www.perfectvenue.com/pricing)).
- Sling: free to 30 users ([page](https://getsling.com/pricing/)).
- MarketMan ([page](https://www.marketman.com/pricing)), Lightspeed ([page](https://www.lightspeedhq.com/pos/retail/pricing/)), Orders.co, annual billing on the $29 offer ([page](https://orders.co/restaurant-dispute-management-assistant)).

**Published price, and a contract is stated.**

- NRS: "Contract required" ([page](https://www.nrsplus.com/pricing)).
- Modisoft: early termination fee, 30-day trial ([page](https://www.modisoft.com/pricing)).
- Marqii: annual contract, per location ([page](https://marqii.com/pricing)).
- SpotOn All-In: 2-year minimum with processing minimums ([page](https://www.spoton.com/pricing/)).
- Clover: 36 or 48 months per one article ([third party](https://www.merchantmaverick.com/clover-pos-cost)).

**Sales call or quote on the page I read.**

Loman, Hostie, VOICEplug, Restaurant365, Birdeye, Podium, Solink, Spot AI, Voosh, and Loop are in the sections above. Veesion, Verkada, Scylla and Tripleseat had no public price found.

**Free or account-gated.**

Google Business Profile, Retail360 ([page](https://petrosoftinc.com/blog-news/retail-360-overview/)), and distributor apps, which need an existing McLane or Core-Mark account.

### Inferences

- Per-location pricing applies to Slang, Homebase, 7shifts, MarginEdge, Marqii, Perfect Venue and Square, which favors a one-store buyer over groups only when the tool's price fits a single store's margin. At $180 to $599 a month, several restaurant tools would exceed what a corner store plausibly spends, but I have no sourced store budget figure, so treat that as a question to put to owners.

### Gaps

- I did not walk any signup flow. "No sales call" should be confirmed by trying signup, which is a task for a person with the owner's permission.
- MarketMan and Modisoft agreements were not read, so minimum terms remain unknown.

## Which jobs have no tool that meets the evaluation criteria, so are real gaps a custom agent could fill?

### Takeaway

Using the five evaluation criteria a vendor page can answer, I could not confirm any tool meeting all five in any job, mostly because data terms are silent or unread. Setting data aside, the real open jobs are a copilot inside the staff group chat, invoice-versus-promise reconciliation for one store, approve-first review replies cheaper than Marqii's $180 a month, and a low-priced dispute tool for one location. Scan data and shelf vision look like gaps but are poor fits for a custom agent.

### Cited Findings

Two of the seven evaluation criteria cannot be met from vendor pages. "Easy to start" needs a timed setup by a helper and "proven in similar shops" needs results after 30 days of use. Of the other five, the closest cases are below.

| Product | Price and cancel terms published | Connects to the shop's software | States data use | Owner stays in charge | Names languages |
|---|---|---|---|---|---|
| Certus | Pass, [page](https://www.certus-ai.com/) | Pass | Not checked | Live answering, the buyer must be told so | Spanish, pass |
| Square features | Pass on plans, Squaremates price unknown | Pass, Square only | Stated for Square AI, [page](https://squareup.com/us/en/press/square-ai-open-beta) | Pass per Managerbot release | Not stated |
| Marqii Scale | Partial, cancel not stated | POS named generically | Not checked | Pass, [page](https://marqii.com/pricing) | Not stated |
| Homebase | Pass | POS generic | Not checked | Drafting only, not customer-facing | Not stated |
| Hisably | Pass | Not stated | Not checked | Back office, not customer-facing | Not stated |
| Kutlerri | Fail, no rate | Categories only | Not checked | Pass on quotes, [page](https://kutlerri.ai/) | Not stated |

Job by job:

- **Group chat copilot.** No product found inside an existing chat, per the one search above.
- **Invoice reconciliation against promised deals.** Capture exists: Hisably, Retail360, ItScans-AI, Lightspeed, Modisoft. I found no tool comparing an invoice to the deal sheet or allowance, in either vertical.
- **Approve-first review replies for one location.** Marqii at $180 is the only one with a clear approval line and a price, on an annual contract ([page](https://marqii.com/pricing)). The Google feature is a limited test ([page](https://www.seroundtable.com/google-reply-to-reviews-with-al-41095.html)).
- **Delivery disputes for one location.** Orders.co at $29 is the only published low price, and its automated resolution is a premium upgrade ([page](https://orders.co/restaurant-dispute-management-assistant)). Voosh's cases are multi-location ([page](https://www.voosh.ai/)).
- **Owner-language operating help outside Toast.** Toast IQ is the only named feature ([page](https://support.toasttab.com/en/article/Everything-Toast-announced-in-our-Spring-26-Release)). Phone tools name customer-call languages, not owner help.
- **Scan data.** Plumbing is sold, and no AI was found. The program rules are contractual and audited, per the sources above.
- **Shelf vision.** Nothing priced for one store. Smartshelf is early beta ([snippet](https://hunted.space/product/smartshelf)).

### Inferences

- **Good fit for a custom agent because the output can wait for the owner's approval and no vendor owns the channel:** the group chat copilot, invoice-versus-promise checks and review reply drafts from text the owner pastes. The last must respect Google's limit on Places data noted above.
- **Poor fit for a custom agent:** scan data, because rules live in a retailer's contract and clawback risk falls on the store, so an agent can explain but should not submit; shelf vision, because it needs tested accuracy; and phones, because a live call cannot wait for approval and 9 products already exist.
- A neutral tool-comparison service that only sets up existing tools has nothing to offer for these gaps today, so its honest answer to an owner is to buy nothing yet.

### Gaps

- A gap claim rests on not finding something in a limited search. Say "no one found combining these parts as of this date" rather than "no one does this."
- I did not test whether Squaremates' planned procurement agents overlap the reconciliation gap. The Q3 letter names them as planned with no date ([page](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm)).

## Who already sells a set of AI agents to restaurants and retailers, what do they charge, and what evidence of use exists?

### Takeaway

Square, Toast, Owner and others in the table below. Square's agent uses a loop where an agent proposes an action and the owner approves, and Toast says its marketing agent is the first of a series. Owner sells a platform with agents at $249 to $499 a month, and horizontal "AI employees" sell from $15.60 to $48.50 a month. Usage evidence is mostly vendor-reported and thin on retention.

### Cited Findings

| Competitor | What it is | Price | Approval model | Evidence of use | Source |
|---|---|---|---|---|---|
| Square Squaremates | Agent in the Square Dashboard, multi-step work, purchase orders for food sellers, procurement agents and an apps platform planned | Beta was free, current price not in letter | "Proposes an action, and sellers approve" (Managerbot release) | "Thousands" used it ([page](https://squareup.com/us/en/press/managerbot-open-beta)). Available to over 1M sellers, per Q1 coverage ([snippet](https://www.fool.com/earnings/call-transcripts/2026/05/08/block-xyz-q1-2026-earnings-transcript/)). Q3 letter gives no usage figures, and says "only 16% of our U.S. sellers use monetized software" ([page](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm)) | page |
| Toast IQ and Toast IQ Grow | Assistant included; Marketing Agent with a human success manager. Toast plans "a series of agents" across marketing, scheduling, payroll and bookkeeping | Grow $499/mo ([third party](https://pulse2.com/toast-iq-grow/?noamp=mobile)) | Not stated | 40,000 weekly active of 171,000 live locations, about 23% by my math, Q1 2026 ([snippet](https://fool.com/earnings/call-transcripts/2026/05/07/toast-tost-q1-2026-earnings-call-transcript)). Grow "on track" to fastest $10M ARR, one case of 70% lower agency spend ([Q2 remarks, page](https://s28.q4cdn.com/141746709/files/doc_financials/2026/q2/Q2-26-Consolidated-Prepared-Remarks-2-1.pdf)). Beta across 144 restaurants, more than 8% sales lift ([snippet](https://pos.toasttab.com/news/toast-debuts-toast-iq-grow-spring-release-2026)), and the footnote's typical before-and-after result is 6% | page and snippet |
| Owner | Agents take a promotion request and make the creative, update the site and publish the campaign. Also calls, reviews, email | $249 + 5% or $499/mo ([page](https://www.owner.com/pricing)) | Not stated | Over $100M ARR, "thousands" of businesses, $240M raised ([Pulse 2, page](https://pulse2.com/owner-raises-240-million-at-2-3-billion-valuation-as-arr-tops-100-million/amp/)). Vendor-reported | page |
| PAR Intelligence and Retail Drive AI | "Agentic OS" for multi-unit operators, Insights and Offers agents. Convenience version too | Not stated | Humans in for critical checks on Retail Drive offers ([snippet](https://www.businesswire.com/news/home/20260303574408/en/PAR-Technology-Launches-PAR-Retail-Drive-AI-The-Intelligence-Layer-Transforming-Convenience-and-Fuel-Retail)) | Taco Bell franchisee test, 20% late-night sales lift at stores flagged ([NRN, page](https://nrn.com/restaurant-technology/the-hot-new-restaurant-tech-trend-ai-agents)). An analyst quoted in trade commentary doubts the "agentic" label ([snippet](https://www.restaurantbusinessonline.com/technology/how-ai-transforming-restaurant-pos)) | page and snippet |
| Tandem | Agents across existing restaurant systems, from xtraCHEF's founders | Not disclosed | Not addressed | 100 location pilot, waitlist, launched Sept 2026 ([RuntimeWire, page](https://runtimewire.com/article/xtrachef-founders-tandem-ai-restaurant-operations)) | page |
| Kutlerri | Catering agent live; delivery, marketing spend and prime cost agents in beta. Managed service | Share of outcomes, no rate | Restaurant approves quotes | RASA, five locations, $450K catering in 10 months, vendor-reported. $4M raised ([page](https://kutlerri.ai/), [snippet](https://foodondemand.com/10062026/off-prem-focused-ai-agent-startup-raises-4m/)) | page |
| AZ Restaurant Partners | "AI Staff for Independent Restaurants," a phone host speaking English, Urdu, Hindi, Spanish, entering orders into Clover, morning text to owners | No setup, no contract, then a cut of orders, rate unpublished | Not stated | Own restaurant live, two signed, 91 phone orders since Sept 1, raising $1M. Company-reported | [page](https://azrestaurantpartners.com/investors.html) |
| Voosh | Delivery ops tools: disputes, reviews, promos, uptime, VooshGPT | Not stated | Auto-reply on reviews | Multi-location case studies | [page](https://www.voosh.ai/) |
| Loop AI | Finance, marketing, operations agents on one data model | Not stated | Metrics approved by the customer | Over 300 brands, per funding coverage ([snippet](https://techstory.in/loop-ai-raises-14-mn-to-untangle-restaurants-delivery-complexity/)) | [page](https://www.loopai.com/) |
| Podium AI Employee | Add-on to any plan | Not stated | Not stated | None read | [page](https://www.podium.com/pricing/) |
| Sintra | 12 named helpers, not restaurant specific | $48.50/mo for 1 month, $23.60 for 3, $15.60 for 12, or $39 per helper; 250 credits, 14-day refund | Not stated | None found | [page](https://sintra.ai/pricing) |
| Marblism | Six AI employees, not restaurant specific | From $24/mo on yearly, other tiers $33 and $44 | Not stated | None verified | [pricing, snippet](https://www.marblism.com/pricing?via=dennis) |

I found no startup using the term "AI GM" for independents. The closest "assistant manager" framing is Decision Logic, aimed at multi-unit brands ([snippet](https://www.pulse.bot/management/news/decision-logic-launches-embedded-ai-that-acts-as-an-assistant-store-manager-for-multi-unit-restauran-183e1d50-6675-461b-b866-ae6f12ecb147/)). Square warns Managerbot "can make mistakes" and NRN notes agents depend on full integration ([NRN, page](https://nrn.com/restaurant-technology/the-hot-new-restaurant-tech-trend-ai-agents)).

### Inferences

- **Where a new approve-first agent would duplicate a POS vendor.** On Square and Toast, an approve-first agent for marketing, schedule drafts and inventory alerts already exists from the vendor that holds the data. A loop where an agent proposes an action and the owner approves matches Square's stated model. Owner's agents already run restaurant marketing, and phones are crowded.
- **Where a new approve-first agent could add value.** Shops on POS systems with no confirmed agent, such as NRS and Modisoft stores, and jobs outside a POS's view such as the staff group chat and paper invoices.
- **Where a neutral tool-comparison service adds value.** Adoption is the gap the numbers show: about 23% of Toast locations use Toast IQ weekly and only 16% of Square's U.S. sellers use monetized software, so helping owners turn on what they already have has a measurable target. Facts are scattered and often unpublished, as the 15 of 45 restaurant price count shows, so checked comparisons help. Vendor agents never compare outside their own stack [secondary, source not reopened].
- **Where a neutral tool-comparison service would be thin.** Corner store comparisons will often read "not stated" on language and data, and the honest answer may be to buy nothing for many jobs.

### Gaps

- Squaremates price, approval wording after the rebuild and seller counts: not in the Q3 letter, and a search for "Squaremates" found no other source.
- Toast's own confirmation of the $499 price and any Q3 2026 Toast IQ weekly figure: not found. The Q2 remarks I read give no weekly number.
- Owner's approval model: not stated in anything I read. Ask the vendor.
- Retention or results after 30 days of use for any agent product: none found beyond Block's statement that retention "surprised to the upside" ([snippet](https://www.fool.com/earnings/call-transcripts/2026/05/08/block-xyz-q1-2026-earnings-transcript/)).
