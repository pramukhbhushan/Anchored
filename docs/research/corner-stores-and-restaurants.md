# Corner Stores and Restaurants: Operations, Pain Points & Backroom Ingestion

Nov 7, 2026 · @Ricky Chen

## TL;DR

This vertical differs from coaching. Coaching maps almost one to one onto Tom's lead loop, and these two trades do not. They keep Backroom's card feed and Executor but need a different hero.

- **Who they are.** Restaurant firms under 20 employees average about $671,000 a location for full service and $579,000 for limited service. No-fuel convenience firms under 5 employees average about $753,000 ([Census SUSB 2022](https://www2.census.gov/programs-surveys/susb/tables/2022/us_state_naics_detailedsizes_2022.xlsx)). Those are means. Median pre-tax margin is 2.8% for full service and 4.0% for limited service, 900+ owners, 2024, no chain split ([NRA](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf)).
- **How they sell.** Stores sell through location and habit. In 779 Bronx exit surveys from 2012, 68% shopped at least daily and 57% bought one item ([Kiszko et al.](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf)). Restaurants sell through word of mouth, walk-bys and Google, and most guests stay anonymous.
- **What they use.** No CRM survey exists for either trade. 42.1% of 318 independents ran old cash registers in a 2025 field count (vendor) ([CSI Works](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf)). Restaurants below the top 250 split across Clover about 20%, Toast about 17% and Square 13% ([Baird via Restaurant Dive](https://www.restaurantdive.com/news/toast-clover-battle-for-small-eateries/809137/)).
- **The hero half holds.** A corner store's core trade has no lead queue. Restaurants match only through custom catering and events, and no measured evidence shows a fast reply raises catering bookings.
- **What replaces it.** A supplier invoice price check, a SNAP stocking check, a license calendar, and catering where it exists. The triggers are a supplier's paper, a federal rule and a calendar, which avoids most texting law. No owner has tested any of them.
- **What reuses Lead Runner.** `propose_card`, the Executor, the card feed, `events`, Morning Brief and `/api/ingest/lead` all carry over. Catering Responder is Lead Runner with a catering profile, and Catering Chaser is Quote Chaser cut to three touches. Price Watch, Stock Check and License Clerk are new skills on the same contract.
- **Who already sells this.** Square's Squaremates and Toast's agents sell the same approve-first loop. Backroom should aim at shops those two do not reach: no POS, NRS, Modisoft and Clover.
- **Money caveat.** Modeled figures below are sales or fee totals, not recoverable amounts. The only traceable invoice-error rate implies about $700 to $1,100 a year on a small restaurant (modeled). Price creep could be larger, but nobody has measured it.
- **Hackathon move.** Add a seeded corner store persona whose hero is an invoice photo, then a stock check card and a license card, with a 20-second restaurant switch for catering. Those three cards send no customer text, so Twilio's trial limit of 5 verified numbers and no custom message bodies does not touch them. Tom's loop still needs a paid Twilio account or a labeled simulated phone.

## How the businesses are structured

Most of these shops are one family's labor and thin margins, so admin lands on the person already at the counter or on the line. Firm size stands in for independents at the small end (inferred). 159,252 full-service firms under 20 employees run 159,644 locations, so nearly all are single-unit.

| Census 2022, US means | Full service | Limited service | Convenience, no fuel |
| --- | --- | --- | --- |
| Firm size shown | Under 20 | Under 20 | Under 5 |
| Locations | 159,644 | 128,238 | 24,641 |
| Employees per location | 6.8 | 6.0 | 1.9 |
| Receipts per location | $671,014 | $579,015 | $752,687 |
| Same, firms under 5 | $392,708 | $343,320 | $752,687 |
| Same, all firms including chains | $1,483,994 | $1,330,932 | $1,302,841 |
| Owner-only shops ([nonemployer file](https://www2.census.gov/programs-surveys/nonemployer-statistics/datasets/2022/historical-datasets/nonemp22us.zip)) | 55,099 at about $64,600 | 42,561 at about $71,300 | Not found |

An earlier synthesis used a $1M restaurant model, so its dollar figures scale down. One point of food cost falls from $10,000 to about $6,700 on $670,000 (modeled). Full-service profit falls from $28,000 to about $18,800 (modeled), and one point stays about 36% of it. All medians for independents remain not found. Convenience receipts use an older NAICS code, and lottery may count only as commission (inferred), so register volume may differ.

**Restaurants.**

- **Size.** Technomic counted 412,498 independents at year-end 2025, down 2.3%, preliminary ([NRN](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025)).
- **Revenue mix.** Off-premises is 89.9% of limited-service traffic and 35.4% of full-service traffic, all operators ([NRA](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf)).
- **Catering.** About 50% of restaurants offered it in 2023, Datassential, no independent split ([C-Store Dive](https://www.cstoredive.com/news/how-c-stores-are-ideal-for-catering-foodservice/693290/)). Orders average $420 per ezCater, 669 operators, January 2025 (vendor) ([release copy](https://www.silicon.co.uk/press-release/new-ezcater-data-highlights-workplace-food-as-a-key-growth-driver-for-restaurants)), or $360 per ChowNow (vendor) ([guide](https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/)).
- **Pricing.** A reliable average check for independents was not found.
- **Profit.** NRA says 42% were not profitable in 2025 in its body text and 45% in its opening letter. Quote 42% with that note.

**Corner stores.**

- **Size.** Baltimore small stores are generally under 1,000 square feet ([20 owner interviews, 2012 to 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC5702771)). A sample of 24 Baltimore stores averaged 165 customers a day, 0.75 paid non-family workers and 1.96 family workers, published 2015 ([Mui et al.](https://www.mdpi.com/1660-4601/12/12/14965)). NACS's average store has 19.9 employees and mostly sells fuel ([NACS](https://www.convenience.org/stay-current/news/2026/april/15/u-s-convenience-in-store-sales-top-$340-billion)), so it does not describe this shop.
- **Offers.** Bronx baskets were sugary drinks 29%, sweets 22%, coffee 14%, sandwiches 13% and chips 12% ([Kiszko et al.](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf)).
- **Pricing.** Owners set prices from wholesaler prices and follow wholesaler sale items ([Baltimore interviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC5702771)).
- **Revenue model.** Sources conflict. One Manhattan owner said cigarettes and lottery are about 80% of a store's revenue, and gave margins of 10 to 20% on cigarettes, about 5% on lottery and 20 to 30% on other goods, 2020 ([MEL](https://melmagazine.com/en-us/story/the-quick-and-ubiquitous-economics-of-bodegas)). NACS's chain-weighted cigarette share is 19.4% of in-store sales ([NACS Magazine](https://www.nacsmagazine.com/Issues/December-2025/Are-Cigarettes-Losing-Their-Grip)). Maryland's mean lottery commission was $45,000 per retailer in FY2025, skewed by chains ([Maryland budget testimony](https://dbm.maryland.gov/budget/FY2027Testimony/E75D.pdf)).
- **SNAP.** 91.7% of the 24 Baltimore stores accepted it ([Mui et al.](https://www.mdpi.com/1660-4601/12/12/14965)). Current EBT share by store type was not found.
- **Price anchor.** A store pays about $38 a month for all NRS POS software (inferred from [IDT's 8-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926019382/ex_949775.htm), seller filing). Restaurants already pay $150 to $350 for one job. No willingness-to-pay study exists for either trade.

## How they sell and market

Neither trade runs a sales conversation as its core. The restaurant's funnel has no captured contact until a direct order, list signup or reservation. The store's funnel has none at all.

**Restaurant path.**

1. **Discovery.** Word of mouth 38%, walk or drive past 30%, in Toast's survey of 1,466 adults, Oct 2025 (vendor) ([PMQ](https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/)). Menufy's 1,000 adults, Apr 2026, put word of mouth at 27% and Google at 34% (vendor) ([Menufy](https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders)).
2. **Check.** 59% have skipped ordering because basic information was missing (vendor, same Menufy survey). 74% look for reviews from the last three months, 1,002 adults, 2026 ([PinMeTo on BrightLocal](https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/)).
3. **First visit or order.** Walk-in, phone or app. A cash walk-in stays anonymous (inferred).
4. **Capture.** Reservation, direct order, loyalty signup or text list. 57% of 1,571 guests said they were interested in restaurant texts, Feb 2024 (vendor, search summary) ([Toast](https://pos.toasttab.com/news/toast-fall-product-release-mobile-app-sms-marketing)).
5. **Delivery.** App guests belong to the app. 55% of first-time DoorDash orders come from browsing (vendor) ([DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends)).
6. **Reviews.** One more Yelp star went with 5 to 9% more revenue at independents and none at chains, Seattle tax data, 2003 to 2009 ([Harvard Magazine on Luca](https://www.harvardmagazine.com/2011/10/hbs-study-finds-positive-yelp-reviews-lead-to-increased-business)). This is the one measured independent split, and it is old.
7. **Catering or event.** The only step with a sales cycle: inquiry, details, quote, follow-up.

Marketing is spare-time work. The one number is 3.7 hours a week, 1,000 Canadian small business owners, 2019 (vendor) ([Menu Magazine](https://menumag.ca/2019/09/26/the-digital-landscape-restaurant-owners-invest-in-social-media-more-than-their-website/)). No US figure was found.

**Corner store path (inferred from the sources cited).**

1. **Location and hours.** 52% of the Bronx sample chose the store because it is near home ([Kiszko et al.](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf)).
2. **Manufacturer signage and price.** Manufacturers dictate near-identical layout and signage (vendor) ([CSI Works](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf)). Cigarette makers spent $5.74B of $8.01B on retailer price discounts in 2022, no chain split ([FTC](https://www.ftc.gov/news-events/news/press-releases/2023/10/ftc-releases-reports-cigarette-smokeless-tobacco-sales-marketing-expenditures-2022)).
3. **Shelf price.** Set from wholesaler cost.
4. **A known face, and sometimes a tab.** A West Baltimore owner chats with regulars and some pay later ([Baltimore Banner, 2022](https://www.thebanner.com/community/local-news/lees-mini-market-west-baltimore-WYBL6RZYM5GY5LSQFG2VH5R6IE/)). Share of stores with tabs was not found.
5. **SNAP timing.** Benefit dates set a monthly rhythm (inferred). Measured peak-day data was only seen in a search summary.
6. **Delivery tie-in.** NRS links to Uber Eats, DoorDash and Grubhub, with no adoption figures (vendor, search summary) ([NRS release](https://www.globenewswire.com/news-release/2026/08/11/3342839/33173/en/index.html)).

Owner marketing hours here are probably near zero (inferred). No source measures them.

## CRMs and tool stack

The CRM is usually absent. No survey measures CRM use at either trade. In a 2023 all-industry vendor survey, 56% of small businesses used none (vendor, search summary) ([Zoho](https://www.bigin.com/lp/state-of-customer-operations-2023.html)). Ask "where do your customers' numbers live?" instead (inferred). A restaurant probably has two to four partial lists. A store probably has none outside the owner's phone.

| Tool | Who uses it | Price per month | What Backroom could pull, and how |
| --- | --- | --- | --- |
| [Square](https://developer.squareup.com/docs/oauth-api/overview) | Both, 13% of small restaurants | $0, $49, $149 | Customers, orders, catalog, inventory, labor. OAuth and webhooks. Whether a real seller needs a Marketplace listing is untested |
| [Toast](https://support.toasttab.com/en/article/Export-a-Filtered-Report-With-Custom-Columns?lang=en_US) | Restaurants, about 17% | $0 to $69 (search summary). Grow $499 or $699, conflict below | Orders, payments, guests. Reports CSV or Email Export to any address. API needs a [location employee](https://doc.toasttab.com/doc/devguide/devApiAccessRequirements.html) |
| [Clover](https://www.merchantmaverick.com/clover-pos-cost) | Both, about 20% of small restaurants | $14.95 to $89.95, 36 or 48 month contract per a third party | Customers, orders, inventory. Merchant token suits pilots only ([Clover](https://docs.clover.com/dev/docs/oauth-and-tokens-faqs)) |
| [NRS](https://www.nrsplus.com/pricing) | Stores, 35,400 locations ([IDT 10-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm)) | $19.95 to $109.95, contract required | Item sales, inventory. Excel or CSV, exact screen not found. No public API found |
| [Modisoft](https://www.modisoft.com/pricing) | Stores | $69, $89 | Sales, lottery, tobacco scan data. Export screen not found. Use photos |
| Old cash register, paper | 42.1% of the CSI sample | $0 | Invoice photos, voice, untested Z-tape photos |
| [OpenTable](https://helpdesk.resy.com/en_us/data-transfer-instructions-BkD17zouu.md), [Resy](https://resy.com/join/plans-pricing/) | Full service | OpenTable conflicts, $149 to $499 most cited. Resy $289, $459 | Guests, reservations. OpenTable emails a CSV link. Consent stays unknown |
| [Perfect Venue](https://www.perfectvenue.com/pricing), Tripleseat | Event venues | Free, $199, $299 annual. Tripleseat has no public price | Leads, contacts, events. API access unconfirmed, CSV or Zapier first |
| [ezCater](https://www.ezcater.com/company/grow-catering-business/selling-fees/) | Catering sellers | 15% plus 2.99% fee (search summary) | Direct-entry customers by CSV. Marketplace orders arrive already structured |
| [DoorDash](https://merchants.doordash.com/en-us/products/pricing), Uber Eats | Both, where linked | 15%, 25%, 30% | Payouts and orders by portal CSV. APIs need partner approval |
| [MarginEdge](https://www.marginedge.com/pricing), [MarketMan](https://www.marketman.com/pricing) | Higher-volume restaurants | $350, from $249 | Invoices, items, vendors. CSV export |
| [Hisably](https://www.hisably.com/pricing) | Stores | $30, plus $15 for AI capture | Lottery, payables. Daily reports arrive by email, so forward them |
| [Homebase](https://www.joinhomebase.com/pricing), 7shifts | Restaurants | $0 to $120 | Timesheets by CSV. Backroom should not rebuild this |
| [QuickBooks](https://quickbooks.intuit.com/pricing/) | Some of both, unmeasured | $38 to $340 | Expenses, payments. Report export first |
| Gmail | Both | Free | Forward only. `gmail.readonly` is [restricted](https://developers.google.com/gmail/api/auth/scopes) and needs a [yearly assessment](https://support.google.com/cloud/answer/13465431) |
| Google Business Profile | Both | Free | Reviews by owner paste. API needs a [60-day profile and approval](https://developers.google.com/my-business/content/prereqs) |

**Vendors already sell the same loop.** Block says Managerbot is now Squaremates and generally available in the US, with no price in the letter ([Block Q3 2026](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm)). Square says "Managerbot proposes an action, and sellers approve" (vendor) ([Square](https://squareup.com/us/en/press/managerbot-open-beta)). Toast added SEO, Reviews, Offers and Scheduling agents ([Toast 8-K](https://www.sec.gov/Archives/edgar/data/0001650164/000165016426000214/tost-20260930xexhibit991.htm)). Toast's approval model was not stated in what was read.

**Owning is not using.** About 40,000 of 171,000 Toast locations used Toast IQ weekly in Q1 2026 (vendor, search summary) ([Toast call](https://fool.com/earnings/call-transcripts/2026/05/07/toast-tost-q1-2026-earnings-call-transcript)). A Square or Toast shop should turn on what it has for marketing, schedules and inventory alerts, and Backroom should not duplicate them.

## How they generate leads

A true lead here is a custom catering or event inquiry. Structured catering orders are already orders, and walk-ins, reservations and hours questions are not leads. No source counts inbound messages per week at a single-store independent.

| Channel | Trade | Evidence | What arrives |
| --- | --- | --- | --- |
| Walk-in and habit | Stores, most restaurant trade | 68% of 779 Bronx shoppers at least daily ([Kiszko et al.](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf)). 165 customers a day in Baltimore against 700 cited for NYC, so traffic varies by about four times | Nothing a tool can see |
| Word of mouth | Restaurants | 38% (Toast) and 27% (Menufy) (vendor), consumer stated | A named guest, sometimes a phone call |
| Google and Maps | Restaurants | About a third across both surveys (vendor, inferred sum) | Call, direction request or site visit. Volume per shop not found |
| Social | Restaurants | Facebook 27%, Instagram 15%, TikTok 14% (vendor) ([PMQ](https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/)) | Comment or DM. DM volume not found |
| Delivery apps | Restaurants, some stores | 5% of consumers (Menufy) against 30% of owners naming apps their top driver (DoorDash), each publisher sells one side (vendor) | An order the app owns |
| Phone | Restaurants | Events and large parties are 7% of about 1.2M calls at 1,000+ locations, reservations 38% (vendor) ([Maple](https://maple.inc/blog/the-state-of-restaurant-phone-communication-insights-from-1-million-calls.md)) | Short question at peak. 68% of calls land in meal windows |
| Catering inquiry | Restaurants with the channel | 5 to 10 a month is modeled, not measured (vendor) ([EatLocally](https://eatlocally-pages.pages.dev/blog/inbound-catering-without-changing-operations)). A Georgia owner calls catering unpredictable, about 2018 ([Statesboro Herald](https://statesboroherald.com/local/business/catering-helps-boro-restaurants-boost-bottom-line)) | Email, form, voicemail or DM, about $360 to $420 |
| Private event | Full service with space | Scattered across a general inbox, per one vendor founder, no sample ([Reunion founder](https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/)) | Date and headcount request |
| Platter or deli order | Small c-store chains, some delis | Breez-In: about 30 orders a month across 6 stores, or 5 per store (inferred). Not a single-store independent ([C-Store Dive](https://www.cstoredive.com/news/how-c-stores-are-ideal-for-catering-foodservice/693290/)) | Mostly voice or in person (inferred) |

At 5 a month, an owner sees a catering card about weekly (inferred). That is too rare to carry the habit, so the invoice check has to give the owner a reason to open the app.

## How they follow up, and where leads leak

No measured evidence shows that a fast reply raises catering or event bookings. What exists is stated importance: 77% of consumers rate venue responsiveness very or extremely important, sample not stated (vendor) ([Tripleseat](https://tripleseat.com/blog/venue-responsiveness-reigns-supreme-why-lightning-fast-communication-is-your-venues-secret-weapon/)). The 24 to 72 hour reply time and one to three day proposal time come from one vendor founder with no sample ([Reunion founder](https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/)). So the blueprint's card reason, "fast replies book far more often", must not appear on a catering card. Proposal speed may matter more than first-reply speed (inferred).

| Leak point | What happens today | The fix |
| --- | --- | --- |
| Catering or event email | Sits in a shared inbox, gets forwarded, then one follow-up or none (vendor, no sample) | Reply with three to five standard packages, touches at day 1, day 3 and week 1, then stop |
| Web form | Arrives at lunch and waits until morning, a vendor scenario, not measured | Owner alert plus a drafted reply, sent after the rush |
| Instagram DM | Volume and reply rate not found | Owner pastes it, `dm_paste` makes a lead |
| Missed call | 6.9 to 40.1% missed by segment, 12,091 recordings (vendor) ([Revmo](https://revmo.ai/guides/state-of-calls-report)). Recovery rate not found | Card to call back. One text only with a consent flag. Never answer live, since a call cannot wait for a tap |
| Review | Single-location reply rate near 15% against nearly 60% for chains (vendor, search summary) ([RightResponse](https://rightresponseai.com/blog/100000-restaurant-reviews)). 50% dislike generic replies ([PinMeTo](https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/)) | Draft from pasted text that cites one detail |
| Lapsed regular | Often invisible. 27% of operators know which promotions produce repeats (vendor) ([DoorDash](https://merchants.doordash.com/blog/restaurant-industry-trends)) | Skip for now. It needs captured contacts and consent, which cash shops lack |
| Store tab | Paper or memory (inferred), and the owner knows the person | Not a lead. One rule card only: a SNAP sale on credit can bring a 1-year disqualification ([7 CFR 278.6](https://www.law.cornell.edu/cfr/text/7/278.6)) |

The one practitioner cadence found is three touches, then stop. Tom's day 1, 3 and 7 chase fits it, but a chase past that adds legal exposure and repeat requests. Each 5-point rise in repeat alerts cut acceptance 10% among 112 clinicians, 2017, a transfer from another field ([Ancker](https://pmc.ncbi.nlm.nih.gov/articles/PMC5387195/)).

## Pain points: the day-to-day manual work

No time diary or representative weekly hours figure exists for either trade, and admin hours were not found. Single-owner reports convert to about 56 to 105 hours a week at stores (inferred). Working estimates are 60 to 80+ hours for a store owner and 50 to 70+ for a working restaurant owner, from anecdotes and not findings.

**A typical day at a full-service restaurant (a composite, not an observed owner).** The 8:00, 10:45, lunch, 14:00 and 15:00 times come from a vendor's manager template, not owners ([Restaurant365](https://www.restaurant365.com/blog/a-day-in-the-life-of-a-restaurant-manager/)). Other placements are composite. Owner accounts show plans breaking when the rush pulls the owner into service ([Bep-Pa owner essay](https://bep-pa.com/running-a-family-restaurant/), [Sykes interview](https://lesleysykes.substack.com/p/day-in-the-life-4-restaurant-owner)). The Manual? column is mostly inferred.

| Time | Task | Manual? | Why it hurts |
| --- | --- | --- | --- |
| 7:00 to 8:00 | Walk through, read overnight messages, find staff gaps | Yes | A no-show cook reshuffles the day |
| 8:00 to 8:45 | Read yesterday's sales, invoices and log | Partly | Recommended ([NineGuides](https://nineguides.com/operations/day-in-life-restaurant-owner/)), likely skipped when the owner works a station |
| 8:00 to 10:00 | Receive deliveries, check against invoice | Yes, paper | Done during prep, so shorts and price changes pass unseen |
| 9:00 to 10:45 | Prep, prep lists, huddle | Yes | Owner labor fills the gap |
| 11:00 to 14:00 | Lunch rush, phone and app orders | Mixed | Calls compete with the line |
| 14:00 | Check invoices, pay vendors | Yes or spreadsheet | No time to compare each line with the last price |
| 15:00 | Count stock, place orders | Yes | Over-ordering and stockouts |
| 15:00 to 17:00 | Hiring, repairs, errands, schedule | Yes | Whatever broke takes the lull |
| 17:00 to 21:00+ | Dinner rush | Yes | No admin is possible |
| 21:00 to 24:00 | Close, cash-out, tip-out | Partly | Tip errors carry wage risk |
| After close | Schedule, reviews, app disputes, books | Mixed | Done in fragments by phone |

**A typical day at a no-fuel corner store with family staff (a composite, not an observed owner).** Shift and wholesale details come from [The Fader, 2016](https://www.thefader.com/2016/06/27/how-6-bodega-owners-make-an-honest-living-in-nyc) and the [Baltimore Banner, 2022](https://www.thebanner.com/community/local-news/lees-mini-market-west-baltimore-WYBL6RZYM5GY5LSQFG2VH5R6IE/). Cash, lottery and paperwork rows are inferred.

| Time | Task | Manual? | Why it hurts |
| --- | --- | --- | --- |
| 5:00 to 7:00 | Open, count drawer, coffee | Yes | One person opens and serves |
| 6:00 to 11:00 | Wholesale run: B Green, BJ's, Costco, Walmart | Yes, paper or memory list | A relative leaves the floor, and the nearest wholesaler beats the cheapest |
| Morning, varies | Direct deliveries | Paper invoice, driver's handheld | Signed in a hurry, then filed unchecked (vendor, search summary) ([Fintech](https://fintech.com/blog/best-practices-for-checking-in-vendor-deliveries-at-the-back-door)) |
| All day | Counter: cigarettes, lottery, EBT, ID checks, tabs | Register or POS | Lottery ties up the one register, and one missed ID risks suspension |
| Midday | Restock, face shelves, check dates | Yes | The counter interrupts |
| As needed | Reprice from new wholesaler cost | Hand labels unless integrated | Unscheduled, and margin leaks until the shelf changes |
| 17:00 | Family shift change | Verbal | Handover by word of mouth |
| 23:00 to 1:00 | Close, count cash, lock up | Yes | Tired count, cash at risk |
| Weekly, time not found | Lottery settlement | Terminal reports | Maryland's cadence was not found |
| Weekly to yearly, time not found | Tax, payroll, tobacco, lottery, health, alcohol, SNAP and WIC renewals | Paper, bookkeeper | Many agencies, no shared calendar |

**Restaurant pains ranked by revenue impact.** All are modeled on $670,000 sales, about 7 staff and $18,800 profit. These are totals, not recoverable amounts.

| Rank | Pain | Per year (modeled) | What a card can recover |
| --- | --- | --- | --- |
| 1 | Delivery commission, if on apps | About $16,800 | Only by moving orders direct |
| 2 | Card fees | $9,400 to $19,900 | Little |
| 3 | No-shows, reservation venues only | About $16,600 in sales before refill | Partly, with deposits |
| 4 | Food cost drift, price creep | $6,700 to $13,400, no measured rate | Partly, and the owner must act |
| 5 | Turnover | $8,000 to $13,000 | Weak |
| 6 | Bookkeeping and tax | $1,200 to $8,400 (vendor prices) | Partly |
| 7 | Missed catering lead | About $4,700 in sales, one a month assumed | Yes, if it arrives as text |
| 8 | Delivery disputes | $1,700 to $2,000, chain data | Partly |
| 9 | Invoice errors | $700 to $1,100 | Yes, but small |
| Tail | Wage claim | $61,568 to $200,137 per reported case (search summary) | Reminders only |

The invoice figure uses 35% of over 11,000 invoices from 400 restaurants carrying an overcharge, typically about 1% of the invoice, 2015 (vendor) ([FSR](https://www.fsrmagazine.com/finance/overcharges-continue-show-restaurant-invoices)).

**Corner store pains ranked by revenue impact.** All are modeled on $750,000 sales. Rates are proxies from all retail, restaurants or supermarkets.

| Rank | Pain | Per year (modeled) | What a card can recover |
| --- | --- | --- | --- |
| 1 | Shrink and theft | $12,000 to $30,000 at retail, weak rates | Weak without POS or cameras |
| 2 | Card fees | $4,500 to $18,400 | Little |
| 3 | Price creep from slow shelf updates | About $7,500, no measured rate | Partly, with a cost list |
| 4 | Lottery commission cut | About $5,700 average fall, FY24 to FY25, skewed | No, informs only |
| 5 | Spoilage | $1,900 to $4,500 | Partly, with date reminders |
| 6 | Delivery and invoice errors | About $2,000, restaurant rate | Yes, by photo, small |
| Event | SNAP loss, 1 year | $6,750 to $37,500 gross profit, plus lost baskets | Yes, for stocking checks and tab warnings |
| Event | Tobacco suspension, 90 days | $6,000 to $36,600 gross profit | Yes, for calendar and rule cards |
| Event | Lottery license loss | About $3,750 a month, Maryland mean, skewed | Yes, for renewal cards |

The sharpest store cards protect a revenue line and do not trim a cost (inferred). Every adoption wave in this segment had an outside push, such as a card customers carry, a rebate or a threat to SNAP (inferred). "Saves you time" has no track record here.

## How Backroom solves it: a shop's crew

Each agent is one SKILL.md that writes a `propose_card`, and the Executor runs nothing until the owner taps Approve. Code ranks and counts, and the model extracts and explains. Numbers on example cards are illustrative.

| Pain point | Backroom agent | Layer | Example card | Executor action |
| --- | --- | --- | --- | --- |
| Both: supplier price rises pass unseen | **Price Watch** (new) | Data + Automation | "Whole milk up $2.10 a case against your Oct 28 invoice. Add to your rep list?" | `append_sheet_row`, or `send_email` to the rep |
| Store: SNAP stocking gap | **Stock Check** (new) | Automation | "Dairy: 5 of 7 varieties by your taps. Add 2 to Monday's run? Not a USDA determination. Rule checked Nov 7." | `append_sheet_row` |
| Both: license and renewal dates | **License Clerk** (new, mostly code) | Automation | "Tobacco license renews in 30 days. Link and checked date attached. Add to your list?" | `append_sheet_row` |
| Store: wholesale run from memory | **Run List** | Intelligence | "Monday's list: 2 SNAP gaps, 1 item repriced by your supplier." | `append_sheet_row` |
| Restaurant: slow catering reply | **Catering Responder** (Lead Runner reskinned) | Automation | "Party of 40, Dec 12, from your form. Send this with 3 packages?" | `send_email`, or `send_sms` with a consent flag |
| Restaurant: no follow-up after a quote | **Catering Chaser** (Quote Chaser reskinned) | Automation | "Quote sent Tuesday. Day 3 check-in? Last one is week 1." | `send_email`, `update_lead` |
| Restaurant: reviews unanswered | **Review Drafter** | Intelligence | "Pasted review mentions cold soup. Draft cites it. Copy?" | None, the owner posts it |
| Restaurant: missed calls | **Call Note** | Data | "Missed call 12:40 from a repeat number. Call back?" | None, or one `send_sms` with a consent flag |
| Restaurant: allergy question | **Allergy Flag** | Automation | "Allergy question from Ana. Call her, or answer yourself." | None. The Executor locks that thread until the owner writes the reply |
| Both: fees nobody reads | **Fee Watch** | Intelligence | "Apps kept $1,410 last month, 4 disputes open." | None, read-only |
| Both: what matters today | **Morning Brief** | Intelligence | "1 price rise, 1 renewal, 1 catering quote waiting." | None, read-only |
| Both: value shown | **Dollars flagged** | Build | "You acted on $48 of price rises this week." | None |

**Do not build:** live phone answering, with nine products already selling it and a call that cannot wait for a tap; schedules, where Squaremates, Toast and Homebase's free tier cover it; tobacco scan rebate submission, which is contractual and audited; shelf vision, with accuracy untested.

**The hero flow** swaps Tom's lead for a supplier's invoice:

1. **Onboarding.** Demo script, not a real owner: "I run a corner store with no scanner, I buy at B Green on Mondays, I take SNAP, and I never look at invoices." The router hires Price Watch, Stock Check and License Clerk.
2. **An invoice lands.** The owner photographs it, and `/api/ingest/invoice` writes an event with `events.source = invoice_photo`. Claude vision extracts lines, and a Zod schema checks them.
3. **Code checks it.** Code confirms quantity times price equals each line, and lines sum to the total. A failed check stops the task and asks the owner. Code then compares each price with the last one on file.
4. **Price Watch proposes a card.** The model explains the change in the owner's language through `propose_card`.
5. **The owner taps Approve.** The Executor runs `append_sheet_row`, or `send_email` to the rep. No customer gets a message.
6. **Stock Check runs.** The owner taps variety counts by category, code applies the published rule text, and the card lists gaps with its source link and checked date.
7. **License Clerk fires.** A `cron` event produces the renewal card.
8. **Switch to the restaurant for 20 seconds.** A judge fills the catering form at `/api/ingest/lead`. Catering Responder uses Lead Runner's code, and code computes the quote from menu and headcount. Catering Chaser schedules three touches, then stops.
9. **Close on the brief.** The Morning Brief and KPI strip show dollars flagged, gaps closed and renewals tracked.

**SNAP status needs a live check.** USDA's final rule set a Nov 4, 2026 compliance date, with seven varieties in each of four staple categories ([Hogan Lovells](https://www.hlc.com/en/publications/usda-issues-final-rule-amending-snap-retailer-stocking-standards)). USDA estimated 87,648 of 119,688 convenience stores, 73%, lacked the varieties, in an analysis written for the proposed rule ([USDA](https://content.govdelivery.com/attachments/WIGOV/2026/08/03/file_attachments/3734770/FNS-2025-0018-0002_content%20%282%29.pdf)). Retailers asked on Aug 31 to defer enforcement and describe a "complicated tiered variety structure" ([letter](https://nationalaglawcenter.org/wp-content/uploads/2026/09/retailers-snap-request-letter.pdf)). No sign USDA agreed was found, and USDA's page refused automated fetches. Build from the rule text and not a flat count of seven. USDA's 4 hours or $200 of effort conflicts with NACS's claim that stores must check nearly every product ([NACS](https://www.convenience.org/stay-current/news/2026/may/8/usda-releases-complex-overhaul-of-snap-stocking-requirements)).

**Twilio limits change the demo.** Trial accounts send only to up to 5 verified numbers and "Custom message bodies" are not available ([Twilio](https://www.twilio.com/docs/messaging/guides/how-to-use-your-free-trial-account)). This breaks the blueprint's fallback of verifying teammates' phones. Registration needs a paid account, and Twilio says it "blocks messages to U.S. numbers" with no approved campaign ([error 30034](https://www.twilio.com/docs/api/errors/30034)). Review time is unconfirmed. Use the invoice flow, `send_email` for catering, and a simulated phone that says so on screen.

**Data model changes.** Generalize `leads.move_date` and `leads.size` into a `details` JSON (event date, headcount, package), the same change coaching asks for. Add catering stages `New, Contacted, Quoted, Booked, Lost`; stores need no stages. Add `leads.consent`. Add `documents`, `invoice_lines` (item, quantity, unit price, line total, confirmed), `obligations` (type, agency, due date, source URL, checked date) and `stock_checks` (category, count, rule version). Add `cards.assignee`, since a store may have several relatives on shift (inferred). Keep the four action types.

**KPIs.** Dollars of price rises caught and acted on, SNAP gaps closed, renewals on time, invoice dollars corrected, catering reply time where it applies, and still in use after 30 days. All are proposals. Report edit rate, skip rate and time to decide. Hours back and share approved from the phone both count tapping, so a shop could score high and save nothing (inferred). A high approval rate is a warning: Anthropic reports 93% acceptance of Claude Code prompts, developers only (vendor) ([Anthropic](https://www.anthropic.com/engineering/claude-code-auto-mode)). Cap requests at 3 to 5 a day, batched outside the rush, with Skip on timeout. That cap is an estimate, since no study counts owner approvals. 1 of 4 Baltimore owners quit an 11-day pilot at one tap per sale, 2019 data ([POST](https://pmc.ncbi.nlm.nih.gov/articles/PMC8883529/)).

**Twelve keep-outs.** The Executor enforces these in code. A tap does not cure them. Legal points are research and not legal advice, and the FCC's Oct 26, 2026 amendment to 47 CFR 64.1200 was not read.

| Keep out | Rule | Status |
| --- | --- | --- |
| Answers to allergen questions | A tap turns a guess into the restaurant's statement. [Food Code notice](https://www.fda.gov/food/retail-food-industryregulatory-assistance-training/addition-2022-food-code-sesame-added-major-food-allergen) applies where adopted | Maryland adoption unconfirmed |
| Recording or transcribing calls without all-party consent | [Md. 10-402](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=10-402), felony | AI transcription unsettled |
| Outbound AI voice calls without consent | [FCC 24-17](https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf) | Settled for outbound |
| Customer texts with no consent record, STOP language or quiet hours | [Twilio policy](https://www.twilio.com/en-us/legal/messaging-policy), [Md. 14-4502](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4502) bars 8 p.m. to 8 a.m. | Missed-call text-back unsettled |
| Tobacco, vape and nicotine in customer texts | [Twilio 30958](https://www.twilio.com/docs/api/errors/30958), "regardless of local legality" | Block alcohol and lottery too until Twilio confirms |
| Age checks, or implying one | [21 CFR 1140.14](https://www.law.cornell.edu/cfr/text/21/1140.14), face-to-face | Settled |
| EBT segments, discounts or surcharges | [7 CFR 278.2](https://www.law.cornell.edu/cfr/text/7/278.2) | Opt-in promotions unanswered |
| Lottery prices, and pricing from personal data | [Md. 9-124](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsg&section=9-124), [HB 895 summary](https://www.troutmanprivacy.com/2026/04/maryland-enacts-protection-from-predatory-pricing-act/) | Below-cost rules unconfirmed |
| Tip math, tip pools, unchecked schedules | [DOL Fact Sheet 15](https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa), [Md. 3-211](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=3-211) | A lawyer checks any wage statement |
| Writing reviews, tying rewards to ratings, accusing reviewers | [FTC rule](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers) | Honest owner-approved replies allowed |
| Google content outside its limits | [Maps terms](https://cloud.google.com/maps-platform/terms), [Profile policies](https://developers.google.com/my-business/content/policies), 30-day storage | Sending reviews to a model unsettled |
| Reading staff chats, training on POS data, pooling rivals' prices | [WhatsApp terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform), [Square terms](https://squareup.com/us/en/legal/general/developers) | Staff monitoring law not researched |

## Ingestion: what to pull in and where it lands

Ingest in two passes, the same as coaching. Pass 1 builds the Business Profile. Pass 2 feeds events into `/api/ingest/*`, so each new source is one more `events.source` value. The default inputs are a photo, a forward, a paste and a voice note, because most CSV exports need a computer. Square staff say so for report downloads (search summary) ([Square community](https://community.squareup.com/t5/Payments-Troubleshooting/export-sales-report-as-a-excel-or-numbers-file/m-p/761172)), and Gmail documents forwarding only on a computer ([Gmail help](https://support.google.com/mail/answer/10957)).

**Pass 1: context (runs once at onboarding)**

| What | How we get it | Lands in | Used by |
| --- | --- | --- | --- |
| Trade, fuel, deli, offers, prices, hours | Voice or typed intro, website or menu link if any | `businesses.profile` | Every agent |
| Licenses and programs: tobacco, vape, lottery, alcohol, health, SNAP, WIC | Interview, photo of each license | `profile.licenses`, `obligations` | License Clerk |
| Suppliers, run days, rep contacts | Interview, last 2 invoice photos | `profile.suppliers` | Price Watch, Run List |
| Systems: POS, apps, books, or "paper and phone" | Tap logos | `profile.systems` | Router |
| Catering packages, lead time, kitchen limit | Interview or menu photo | `profile.catering` | Catering agents |
| Tone, sample replies | Paste or dictate | `profile.voice` | Catering, Review Drafter |
| Owner language, who holds the phone per shift | Tap | `profile.language`, `profile.team` | Every card |
| Task audit | "What eats your week?" | Router input, `crew.tasks_covered` | Automation % KPI |

**Pass 2: data and live events (ongoing)**

| Source | Method | Hackathon? | `events.source` | Lands in | Layer |
| --- | --- | --- | --- | --- | --- |
| Paper or PDF invoices | Photo to `/api/ingest/invoice`, vision, Zod, code arithmetic | Yes (hero), about 3 to 5 hours (estimate) | `invoice_photo` | `documents`, `invoice_lines` | Data |
| Shelf variety counts | Tap checklist by category, no shelf vision | Yes | `stock_tap` | `stock_checks` | Data |
| License and rule checks | Cron over `obligations` | Yes | `cron` | `cards` | Automation |
| Catering or event form | Form posts to `/api/ingest/lead` | Yes | `lead_form` | `leads`, `events` | Data |
| POS or wholesaler file: NRS, Square, Clover, Toast, DoorDash | CSV upload, Claude maps columns, seeded fake data labeled | Yes, about 1 to 2 hours (estimate) | `csv` | `events`, `leads` | Data |
| SMS replies | Twilio inbound webhook | Only with paid Twilio, or a labeled simulated phone | `sms_in` | `messages` | Data |
| Forwarded invoices, catering asks, Toast Email Export, Hisably reports | Forward to a Backroom address | Cheap stretch | `email_in` | `messages`, `leads`, `documents` | Data |
| Missed calls | Twilio `DialCallStatus`, no recording | Stretch, about 2 to 3 hours (estimate) | `missed_call` | `events`, `cards` | Data |
| Square orders and inventory | OAuth and webhooks. Sandbox needs a seed script and lacks Square for Restaurants | Stretch, labeled | `pos_event` | `events` | Data |
| Instagram DMs, WhatsApp export | Owner pastes or exports one chat | Yes for paste | `dm_paste` | `leads`, `messages` | Data |
| Reviews | Owner pastes, labeled owner-supplied | Yes | `review_paste` | `events` | Intelligence |
| Voice notes | Browser speech, typed fallback | Yes | `voice_note` | `events` | Intelligence |
| Toast API, Google Business Profile API, Meta APIs, delivery APIs, Gmail OAuth | Partner or review gates | Post-hackathon | `crm_sync`, `email_in` | Same tables | Data |

**Invoice accuracy is unproven.** No evidence covers handwritten or thermal distributor invoices. One vendor reports 85 to 92% for phone photos, about 4,800 invoices, and 60 to 80% for handwriting with no method (vendor) ([Invoox](https://invoox.io/en/blog/ai-vision-invoice-extraction-accuracy/)). A vision call costs about $1.30 per 1,000 images at Haiku 4.5 rates ([Claude docs](https://platform.claude.com/docs/en/build-with-claude/vision)). Run 10 real invoices, including a handwritten and a faded thermal one, and report field accuracy.

**Normalization rule.** Every source becomes one of three records, through a forced tool call and then a Zod check.

- **Lead:** `name, phone, email, source_channel, need, event_date, headcount, consent, stage, last_contact_at, next_step`.
- **Invoice line:** `supplier, invoice_date, item, unit, quantity, unit_price, line_total, confirmed`.
- **Obligation:** `type, agency, due_at, source_url, checked_at, owner_confirmed`.

Merge duplicate customers on phone or email. Consent starts unknown, so nothing is texted. Photos, pasted text and vendor files are untrusted data, and any instruction inside them is ignored.

## The repeatable ingestion workflow

The same seven steps as coaching apply, and only the template changes. Owner minutes below are estimates. Nobody has timed them, so test with a stopwatch on three owners before quoting "10 minutes". A helper should be present, outside the rush. Measured voice accuracy in a kitchen or store was not found, so typing and tapping come first.

1. **Pick the vertical template (automatic, 1 minute).** The router detects the trade from the first sentence, or the owner taps "store" or "restaurant". The owner signs in by phone number and picks a language. Korean first in Baltimore, then Spanish and Arabic, is inferred. A native speaker checks those screens.
2. **Interview (2 minutes).** One screen each.

   *Corner store:*
   1. What do you sell? Fuel? A deli or platters?
   2. Which do you hold: tobacco, vape, lottery, alcohol, SNAP, WIC? When does each renew?
   3. Who do you buy from, and on which days?
   4. Scanner POS, cash register or paper?
   5. What do you do every week that you wish someone else did?

   *Restaurant:*
   1. Sit-down or counter? What do you sell, and at what prices?
   2. Who supplies you, and how do invoices reach you?
   3. Do you take catering or parties? How many asked last month, and where did they ask?
   4. Which POS, apps and reservation tools do you use?
   5. What eats your week? Say a reply you've sent that sounds like you.

3. **Enrich from a link or photo (30 seconds).** Website, menu or Google listing link. No link is fine.
4. **Confirm the profile (1 minute).** One "Here's your business" screen. A misheard price would flow into every card, so nothing counts until the owner confirms.
5. **First real data (2 minutes).** Photograph the last two invoices. Code checks the arithmetic, and the owner confirms lines.
6. **Connect live sources (2 minutes).** Taps only: the forwarding address and the catering form link for restaurants. Square shops get one OAuth tap. A carrier forwarding code for missed calls is optional.
7. **Hire the crew and show the first cards (1 minute).** Show a first price card if a second invoice gives a comparison, a renewal card and a stock check prompt. Label anything simulated on screen.

**Phone-only owner.** Never depend on a CSV. Photos, forwards, pastes and voice work from a phone. For exports, send a "steps for my computer" link. Toast's Email Export goes straight to a Backroom address, and OpenTable emails a link (both untested against an inbound address). Accept files from the phone's Files app and from a Gmail attachment share. Gmail read access stays out at launch.

**Store with no POS.** Treat this as the default store path. Skip the systems steps and run Price Watch from photos, Stock Check from taps and License Clerk from license photos. Run List stays weak without sales data, so it only carries gaps and flags. Offer "do nothing" where a card has no input.

**Quality bar per onboarding:** profile confirmed, at least one real invoice or license on file, at least one card from the owner's own data. If any is missing, the Morning Brief asks the next day. For the hackathon, all steps are demoable with seeded data, and only the catering branch needs Twilio or email.

## Sources

Pages were opened on Nov 6 or 7, 2026, per the research notes. Vendor sources (Toast, Square, Block, IDT and NRS, Maple, Menufy, DoorDash, ChowNow, ezCater, Tripleseat, Reunion, EatLocally, CSI Works, Restaurant365, Invoox, Revmo, Consolidated Concepts in FSR) sell related products, so their numbers lean toward them. Almost no dataset splits independents from chains. Census by firm size, Luca, James Beard, Baltimore studies and owner accounts are the exceptions.

**Reddit could not be read.** The fetch tool refused old.reddit.com and search refused reddit.com. Owner voice stays thin, and someone should read r/restaurantowners and r/smallbusiness by hand. One third-party snapshot of an r/asklatinamerica thread was opened, and it holds two conflicting comments about store tabs, reliability unverified. No owner quote here is invented, and day tables and onboarding minutes are composites or estimates.

**Where sources conflict**

| Conflict | Sources | Treatment |
| --- | --- | --- |
| Unprofitable operators | NRA letter 45%, NRA body and NRN 42% | Quote 42% with a note |
| Toast IQ Grow price | $499 ([Pulse 2](https://pulse2.com/toast-iq-grow/?noamp=mobile)) against from $699 ([NRN, Oct 2026](https://www.nrn.com/restaurant-technology/toast-unveils-an-array-of-new-ai-agents-for-restaurants)) | Unresolved, Toast's page was blocked |
| Store cigarette and lottery share | One owner about 80%, NACS 19.4% cigarettes | Different stores, no survey of independents |
| Store traffic | 165 a day in Baltimore, 700 cited for NYC | Use neither as typical |
| SNAP convenience count | USDA 119,688 in June 2025, [live layer](https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0) 108,293 | Cause unknown, do not call it exits |
| Unregistered Twilio texts | Error page says blocked, overview mentions fees | Plan for blocked |

**What was not found:** an independent test of AI agents in a shop this size; owner hours or a time diary; median revenue; independent store margins; measured price creep; catering inquiries, close rate or reply time at independents; any catering conversion by reply time; owner approval rates; store price sensitivity; a list of what owners refuse to automate; BUD trial outcomes; enforcement reports since Nov 4.

**Opened**

- [Census SUSB 2022 workbook](https://www2.census.gov/programs-surveys/susb/tables/2022/us_state_naics_detailedsizes_2022.xlsx): receipts and employees by firm size
- [Census nonemployer 2022](https://www2.census.gov/programs-surveys/nonemployer-statistics/datasets/2022/historical-datasets/nonemp22us.zip): owner-only shops
- [NRA State of the Restaurant Industry 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf): margins, channels, profit
- [NRN on Technomic](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025): independent count
- [NRN on Toast agents](https://www.nrn.com/restaurant-technology/toast-unveils-an-array-of-new-ai-agents-for-restaurants): Grow price, new agents
- [Kiszko et al. 2015](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf): 779 Bronx exit surveys
- [Mui et al. 2015](https://www.mdpi.com/1660-4601/12/12/14965): 24 Baltimore stores, opened Nov 6, 403 on Nov 7
- [Baltimore owner interviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC5702771): pricing, supply, language
- [POST pilot](https://pmc.ncbi.nlm.nih.gov/articles/PMC8883529/): 1 of 4 owners quit
- [Ancker 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5387195/): alert acceptance falls with volume
- [CSI Works 2025](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf): 318-store field count (vendor)
- [IDT 8-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926019382/ex_949775.htm): NRS revenue per terminal (seller)
- [IDT 10-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm): NRS locations, opened in one note, 503 in another
- [Baird via Restaurant Dive](https://www.restaurantdive.com/news/toast-clover-battle-for-small-eateries/809137/): POS shares, analyst estimate
- [Block Q3 2026 letter](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm): Squaremates
- [Square Managerbot release](https://squareup.com/us/en/press/managerbot-open-beta): approve-first wording (vendor)
- [Toast 8-K](https://www.sec.gov/Archives/edgar/data/0001650164/000165016426000214/tost-20260930xexhibit991.htm): Toast agents
- [Toast via PMQ](https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/): discovery shares (vendor)
- [Menufy](https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders): discovery shares (vendor)
- [DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends): owner views (vendor)
- [PinMeTo on BrightLocal 2026](https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/): review behavior, secondary
- [Harvard Magazine on Luca](https://www.harvardmagazine.com/2011/10/hbs-study-finds-positive-yelp-reviews-lead-to-increased-business): Yelp star effect
- [Menu Magazine](https://menumag.ca/2019/09/26/the-digital-landscape-restaurant-owners-invest-in-social-media-more-than-their-website/): 3.7 marketing hours, Canada
- [FTC 2022 cigarette report release](https://www.ftc.gov/news-events/news/press-releases/2023/10/ftc-releases-reports-cigarette-smokeless-tobacco-sales-marketing-expenditures-2022): trade spending
- [ChowNow](https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/): $360 order, catering shapes (vendor)
- [ezCater release copy](https://www.silicon.co.uk/press-release/new-ezcater-data-highlights-workplace-food-as-a-key-growth-driver-for-restaurants): $420 order (vendor)
- [C-Store Dive](https://www.cstoredive.com/news/how-c-stores-are-ideal-for-catering-foodservice/693290/): Datassential share, Breez-In
- [Reunion founder in Modern Restaurant Management](https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/): reply times, cadence (vendor)
- [Tripleseat](https://tripleseat.com/blog/venue-responsiveness-reigns-supreme-why-lightning-fast-communication-is-your-venues-secret-weapon/): stated importance (vendor)
- [EatLocally](https://eatlocally-pages.pages.dev/blog/inbound-catering-without-changing-operations): modeled frequency (vendor)
- [Statesboro Herald](https://statesboroherald.com/local/business/catering-helps-boro-restaurants-boost-bottom-line): owner accounts of catering
- [Maple](https://maple.inc/blog/the-state-of-restaurant-phone-communication-insights-from-1-million-calls.md): call mix (vendor, read as marketing)
- [Revmo](https://revmo.ai/guides/state-of-calls-report): call miss rates (vendor)
- [Restaurant365](https://www.restaurant365.com/blog/a-day-in-the-life-of-a-restaurant-manager/): manager day (vendor)
- [NineGuides](https://nineguides.com/operations/day-in-life-restaurant-owner/): recommended owner day
- [Bep-Pa owner essay](https://bep-pa.com/running-a-family-restaurant/): owner's day
- [Sykes interview](https://lesleysykes.substack.com/p/day-in-the-life-4-restaurant-owner): owner's split week
- [The Fader](https://www.thefader.com/2016/06/27/how-6-bodega-owners-make-an-honest-living-in-nyc): family shifts
- [Baltimore Banner](https://www.thebanner.com/community/local-news/lees-mini-market-west-baltimore-WYBL6RZYM5GY5LSQFG2VH5R6IE/): wholesale runs, tabs
- [MEL](https://melmagazine.com/en-us/story/the-quick-and-ubiquitous-economics-of-bodegas): one owner's margins
- [NACS Apr 2026](https://www.convenience.org/stay-current/news/2026/april/15/u-s-convenience-in-store-sales-top-$340-billion): chain-weighted store
- [NACS Magazine](https://www.nacsmagazine.com/Issues/December-2025/Are-Cigarettes-Losing-Their-Grip): cigarette share
- [Maryland budget testimony](https://dbm.maryland.gov/budget/FY2027Testimony/E75D.pdf): lottery commissions
- [FSR on overcharges](https://www.fsrmagazine.com/finance/overcharges-continue-show-restaurant-invoices): invoice errors, 2015 (vendor)
- [Hogan Lovells](https://www.hlc.com/en/publications/usda-issues-final-rule-amending-snap-retailer-stocking-standards): SNAP final rule
- [USDA impact analysis](https://content.govdelivery.com/attachments/WIGOV/2026/08/03/file_attachments/3734770/FNS-2025-0018-0002_content%20%282%29.pdf): 73% estimate
- [Retailer letter](https://nationalaglawcenter.org/wp-content/uploads/2026/09/retailers-snap-request-letter.pdf): deferral request (advocacy)
- [NACS May 2026](https://www.convenience.org/stay-current/news/2026/may/8/usda-releases-complex-overhaul-of-snap-stocking-requirements): effort claim (advocacy)
- [7 CFR 278.6](https://www.law.cornell.edu/cfr/text/7/278.6): SNAP penalties
- [Twilio trial guide](https://www.twilio.com/docs/messaging/guides/how-to-use-your-free-trial-account): 5 numbers, no custom bodies
- [Twilio error 30034](https://www.twilio.com/docs/api/errors/30034): unregistered sends blocked
- [Gmail scopes](https://developers.google.com/gmail/api/auth/scopes): restricted scopes
- [Google security assessment](https://support.google.com/cloud/answer/13465431): yearly revalidation
- [Gmail forwarding help](https://support.google.com/mail/answer/10957): computer-only steps
- [Toast report export](https://support.toasttab.com/en/article/Export-a-Filtered-Report-With-Custom-Columns?lang=en_US): CSV and Email Export (vendor)
- [Square OAuth](https://developer.squareup.com/docs/oauth-api/overview): token flows (vendor)
- [NRS](https://www.nrsplus.com/pricing), [Modisoft](https://www.modisoft.com/pricing), [Hisably](https://www.hisably.com/pricing), [MarginEdge](https://www.marginedge.com/pricing), [MarketMan](https://www.marketman.com/pricing), [Homebase](https://www.joinhomebase.com/pricing), [Perfect Venue](https://www.perfectvenue.com/pricing), [Resy](https://resy.com/join/plans-pricing/), [DoorDash](https://merchants.doordash.com/en-us/products/pricing), [QuickBooks](https://quickbooks.intuit.com/pricing/): vendor price pages, 10 sources
- [Invoox](https://invoox.io/en/blog/ai-vision-invoice-extraction-accuracy/): photo accuracy (vendor)
- [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision): image cost and limits (vendor)
- [Anthropic on Claude Code](https://www.anthropic.com/engineering/claude-code-auto-mode): 93% acceptance (vendor)
- [r/asklatinamerica snapshot](https://reddit.sentinel-team.org/posts/1sr4sfy/snapshots/2026-04-21T06%3A15%3A38.640218Z): two comments on tabs, third-party copy
- [Pulse 2](https://pulse2.com/toast-iq-grow/?noamp=mobile): $499 Grow price, third party
- [Merchant Maverick](https://www.merchantmaverick.com/clover-pos-cost): Clover prices and contract, third party

**Search summary only, not opened**

- [Toast Q1 2026 call](https://fool.com/earnings/call-transcripts/2026/05/07/toast-tost-q1-2026-earnings-call-transcript): 40,000 weekly Toast IQ users (vendor)
- [RightResponse](https://rightresponseai.com/blog/100000-restaurant-reviews): review reply rates (vendor, 403)
- [Toast SMS page](https://pos.toasttab.com/news/toast-fall-product-release-mobile-app-sms-marketing): 57% interested in texts (vendor)
- [Fintech](https://fintech.com/blog/best-practices-for-checking-in-vendor-deliveries-at-the-back-door): invoices filed unchecked (vendor)
- [Zoho via Bigin](https://www.bigin.com/lp/state-of-customer-operations-2023.html): 56% with no CRM (vendor)
- [Square community](https://community.squareup.com/t5/Payments-Troubleshooting/export-sales-report-as-a-excel-or-numbers-file/m-p/761172): reports need a computer (vendor staff)
- [ezCater fees](https://www.ezcater.com/company/grow-catering-business/selling-fees/): 15% plus 2.99% (vendor)
- [NRS Uber Eats release](https://www.globenewswire.com/news-release/2026/08/11/3342839/33173/en/index.html): delivery link (vendor)
- [DOL wage cases](https://www.dol.gov/newsroom/releases/whd/whd20251219): $61,568 to $200,137, exact release per case unconfirmed

Keep-out legal sources are linked in their table. The architecture and names come from the Backroom blueprint, the team's internal design document, read as a PDF.
