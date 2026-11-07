# Sales, leads and follow-up at independent US corner stores and restaurants

Checked Nov 7, 2026. This note adds to `restaurant_operations.md` and `corner_store_operations.md` in "Corner stores and restaurants fit" and does not repeat their figures except where a test needs them.

Tags:
- [Opened]: I fetched the page and read its content through the fetch tool's extract, or read PDF text I extracted myself.
- [Snippet]: I saw it only in a search summary. Open it before relying on it.
- [vendor]: the publisher sells a fix for the problem it measures.
- "Mine" marks my inference or arithmetic.

The coordinator cut this run short, so anything unchecked reads "not found." No quotes appear below. Everything is paraphrase.

Mapping to the document sections:
- "How they do sales and marketing, step by step": the restaurant steps, corner store steps and who-does-marketing questions.
- "How they generate leads, by channel, with evidence": the channel shares and catering questions.
- "How they follow up, and where leads leak": the follow-up question.

Independents versus chains: almost nothing here splits them. Sources that are independent-specific are Luca's Yelp study, the RightResponse review count, the Chowly case studies, the Statesboro owner accounts and the bodega studies. Every other figure is all-restaurant or unsplit.

## What is a lead in each trade? Testing the earlier claim

### Takeaway
The claim half holds. Corner store core trade has no lead queue, and new evidence strengthens that. "Restaurants match through catering and events" holds only for custom events and custom catering. Structured catering orders need no reply, volume looks like single digits a month per location on thin evidence, and no source measures that a fast reply raises bookings.

### Cited findings
Evidence for the claim, corner stores:
- 779 exit surveys with bag checks at four Bronx bodegas, 2012: 68% shop there at least daily (21% once a day, 47% more than once), 52% chose the store because it is near home, and 57% bought one item. Top purchases were sugary drinks 29%, sweets 22%, coffee 14%, sandwiches 13%, chips 12%. Sites sat near schools and surveys ran on weekdays 7am to 4pm, so it is not a random sample. [Kiszko et al. 2015](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf) [Opened]
- The same paper cites upwards of 700 customer visits per typical NYC store between 8am and 8pm. The earlier notes have 165 customers a day in Baltimore. The two differ by about four times, so traffic varies widely by city or the methods differ. [Kiszko et al. 2015](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf) [Opened]
- Baltimore: 97% of corner store shoppers walked, against 49% of supermarket shoppers (175 low-income adults). 83% of 127 regular customers shopped weekly at their neighborhood store. The search summary did not give me a firm link for each figure. [Search result, PMC5730500](https://pmc.ncbi.nlm.nih.gov/articles/PMC5730500) [Snippet; the page returned a captcha, and which study carries which figure is not confirmed]
- South Bronx interviews in 2022 with 6 bodega owners and 25 customers: owners liked online ordering. Most customers said the store was too close for online ordering to make sense, and both groups named a digital divide. They also said customers feared losing community ties. [NYU Steinhardt on Trude et al. 2024](https://steinhardt.nyu.edu/news/online-food-shopping-exploded-during-covid-19-pandemic-can-it-catch-bodegas) [Opened]

Evidence against the claim, restaurants:
- Catering splits into two shapes. Direct catering runs through a web menu and checkout, and marketplaces route orders and keep the customer. Neither waits on a personal reply. [ChowNow, May 2026](https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/) [Opened, vendor]
- Inbound demand is wider than catering. Earlier notes' Maple figures have reservations at 38% of calls against 7% for events and large parties, so most restaurant inbound is a short question, not a sales cycle. [Maple, via restaurant_operations.md](https://maple.inc/blog/the-state-of-restaurant-phone-communication-insights-from-1-million-calls.md) [earlier note, vendor]
- A routing vendor itself says to skip its tool below about 4 private events a month, because a general manager's personal email is faster. [US Tech Automations](https://ustechautomations.com/resources/blog/automate-route-privateevent-inquiries-by-date-and-headcount-2026) [Snippet, vendor; exact page not confirmed]
- An independent owner in Georgia called catering unpredictable and treated it as a bonus. [Statesboro Herald, about 2018](https://statesboroherald.com/local/business/catering-helps-boro-restaurants-boost-bottom-line) [Opened]
- About half of restaurants offer catering at all: 43% in 2018, 50% in 2023, Datassential. Not split by independents. [C-Store Dive, Sept 2023](https://www.cstoredive.com/news/how-c-stores-are-ideal-for-catering-foodservice/693290/) [Opened]
- "Follow up until they book or buy" conflicts with the one practitioner cadence I found: three touches, then stop. [Reunion founder in Modern Restaurant Management, Apr 2026](https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/) [Opened, vendor]

Evidence against the claim, corner stores:
- Lead-like catering exists at small c-store chains. Breez-In, 6 Virginia stores, takes about 30 catering orders a month through its website, 10% of foodservice sales, peaking in summer and around graduations and holidays. Huck's, 126 stores, averages under $100 an order, with some reaching $3,000. Neither is a single-store independent. [C-Store Dive, Sept 2023](https://www.cstoredive.com/news/how-c-stores-are-ideal-for-catering-foodservice/693290/) [Opened]
- Sandwiches are 13% of purchases in the Bronx sample, so a deli counter is common, and that is the base a platter order would come from. [Kiszko et al. 2015](https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf) [Opened]
- A neighborhood store listing advertises party platters, and a Caviar listing shows a sandwich platter. Independence and volume are not confirmed. [Alexanders listing](https://www.atly.com/location/Alexanders), [Caviar](https://www.trycaviar.com/en/store/39400) [Snippet]

### Inferences
Mine, a working definition of a lead:

| Event | Restaurant | Corner store | Fits reply and follow-up flow? |
|---|---|---|---|
| Custom event or private party inquiry | True lead, about $2,000 per event on one old vendor figure | None found | Yes, the only clean fit |
| Custom or first-time catering inquiry | True lead, about $360 to $420 | Deli or platter stores only, unmeasured | Yes, if it arrives as text |
| Structured catering order, ezCater or web checkout | Already an order | Breez-In model | No reply needed; reorder prompt only |
| Large party booking | Short lead, one or two messages | None | Partly |
| Missed call | Unknown intent | Calls unmeasured | Text-back only |
| Reservation or hours question | Answer, not a sale | None | Instant answer, no sequence |
| Regular's tab or text order | Rare | Exists anecdotally, unmeasured | Not a lead; owner knows the person |
| Walk-in | Main trade | Almost all trade | No |

- Breez-In's 30 orders a month over 6 stores is 5 per store per month, mine. It is the only count from a named operator, and it sits at the low end of EatLocally's modeled 5 to 10. At that rate an owner sees a catering card about weekly, which supports the earlier note's advice to pair it with a frequent task.
- For a corner store the honest hero is not lead follow-up. A store with a deli counter could get a lead card only if platter orders reach a channel the agent can read, and most would arrive by voice or in person.

### Gaps
- Not found: any count of inbound messages per week at a single-store independent, restaurant or corner store.
- Not found: any independent single-store catering volume.

## Restaurants step by step: discovery to repeat visit

### Takeaway
Discovery runs mostly through people and place, then Google and social. The owner cannot see or message that guest until they order direct or join a list. The step where an owner's action is most measured is reviews. Luca's study finds a star worth 5 to 9% of revenue for independents and nothing for chains, though the data ends in 2009.

### Cited findings
1. Discovery, walk-by: 30% discover by passing a location, second only to word of mouth at 38%. [Toast via PMQ, Jul 2026](https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/) [Opened, vendor]
2. Google and Maps: 34% start with Google search, and 18% name map apps. [Menufy, Jun 2026](https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders) [Opened, vendor]; [PMQ](https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/) [Opened, vendor]
3. Yelp and reviews: 11% name review sites. 35% call positive reviews the top trust factor for a new restaurant. [Menufy](https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders) [Opened, vendor] In BrightLocal's 2026 survey of 1,002 adults, 74% look for reviews from the last three months, 32% from the last two weeks, and 31% use only businesses rated 4.5 or higher, up from 17%. [PinMeTo on BrightLocal](https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/) [Opened, secondary] Google share of review reading is reported as 71%, down from 83%, with Apple Maps 27%, up from 14%. Another outlet says 81% for Google. No restaurant split or 2026 Yelp readership figure found. [Search summaries of BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey/) [Snippet; the page opened with no body]
4. Revenue effect: one more Yelp star went with 5 to 9% more revenue at independents and no effect at chains, in Seattle tax data for 2003 to 2009. Chains lost share as Yelp spread. [Harvard Magazine on Luca](https://www.harvardmagazine.com/2011/10/hbs-study-finds-positive-yelp-reviews-lead-to-increased-business) [Opened, secondary, old]
5. Instagram and TikTok: Facebook 27%, Instagram 15%, YouTube 15%, TikTok 14% across adults. 38% of Gen Z name TikTok as their favorite channel. Urban diners lean social, suburban diners lean word of mouth and location. [PMQ](https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/) [Opened, vendor] 78% of consumers agree social media is a good way to learn about local restaurants, and that includes 75% of boomers. That measures agreement, not use. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) [Opened]
6. Website check: 74% say online presence affects whether they order, and 59% have skipped ordering because basic information was missing. [Menufy](https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders) [Opened, vendor] 32% check a restaurant's site before visiting. [Toast](https://pos.toasttab.com/blog/on-the-line/restaurant-reviews-and-ratings-data) [Snippet, vendor; 403 on open]
7. AI: 22% have used AI to choose a restaurant, and 39% of operators have optimized listings for it. [DoorDash and SevenRooms, Mar 2026](https://merchants.doordash.com/blog/restaurant-industry-trends) [Opened, vendor]
8. Delivery apps: 55% of first-time DoorDash orders come from browsing rather than seeking a specific restaurant. DoorDash reports 79% of delivery customers also dine in, and its own FAQ says 74%. [DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends) [Opened, vendor]
9. Own website ordering: 21% of full-service and 38% of limited-service restaurants offer both third-party and direct delivery ordering. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) [Opened] One Chicago independent moved first-party share of online sales from 52.6% to 83.8%, a single vendor case. [Chowly](https://chowly.com/resources/blogs/restaurant-loyalty-programs/) [Opened, vendor]
10. Reservations: no share of guests found. SevenRooms data is cited with no reservation percentages. [DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends) [Opened, vendor]
11. Email and SMS: 57% of guests say they are interested in texts from favorite restaurants, 1,571 guests, Feb 2024. [Toast product page](https://pos.toasttab.com/news/toast-fall-product-release-mobile-app-sms-marketing) [Snippet, vendor] Toast's claim of 63% more sales for marketing suite users has no method shown, so read it as selection. [Toast](https://pos.toasttab.com/products/toast-marketing) [Snippet, vendor]
12. Loyalty: membership matters when choosing a restaurant to 56% of full-service users, 63% of limited-service users, 65% for takeout and 70% for delivery. Stated importance, likely chain-driven. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) [Opened]
13. Gift cards: Paytronix's 2024 Thanksgiving weekend data covers 366 brands, $17.5M in sales, $66 average full-service card and $31 quick-service card, all named brands being chains. [Restaurant Dive, Dec 2024](https://www.restaurantdive.com/news/restaurant-gift-card-sales-up-17-percent-during-thanksgiving-weekend-paytronix/735960/) [Opened, vendor data] November and December were 45.8% of 2020 gift card sales. [Paytronix via MarketScreener](https://ca.marketscreener.com/news/latest/Paytronix-Holiday-Gift-Card-Research-Finds-Sales-While-Depressed-Peaked-During-Holiday-Season-32168979) [Snippet, vendor data]
14. Repeat visit: see the channel share question below.

### Inferences
- Mine: the funnel has no captured contact until step 8, 9, 11 or 12, or a reservation. A walk-by or word-of-mouth guest who pays cash stays anonymous, so lead follow-up has nothing to send them. A QR or receipt prompt would have to create the contact first.
- Mine: delivery guests belong to the marketplace, so "direct" follow-up cannot reach them even though they may also dine in.
- Mine: the 5 to 9% Yelp effect predates Google's lead in reviews and comes from one city. Use it for direction, and for the independent versus chain split.

### Gaps
- Not found: Google Business Profile claim rate, photo or post effect, or calls and direction requests per independent restaurant.
- Not found: gift card share of sales at independents. An 80% overspend figure appeared in a search summary with no study behind it, so I do not use it.

## What share of new guests or orders comes from each channel?

### Takeaway
Discovery shares are all stated by consumers in vendor surveys, and they conflict because each publisher favors its own channel. No source gives an actual split of third-party against direct orders at independents. Marketing spend sits around 2 to 6% of sales on weak evidence.

### Cited findings
Discovery, percent of consumers:

| Channel | [Toast via PMQ](https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/), 1,466 adults, Oct 2025 [Opened, vendor] | [Menufy](https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders), 1,000, Apr 2026 [Opened, vendor] |
|---|---|---|
| Word of mouth | 38 | 27 |
| Walk or drive past | 30 | not reported |
| Search | 16 | 34 (Google) |
| Map apps | 18 | not reported separately |
| Facebook | 27 | 15 (all social) |
| Instagram | 15 | in social |
| TikTok | 14 | in social |
| YouTube | 15 | in social |
| TV ads | 18 | not reported |
| Review sites | not reported | 11 |
| Delivery apps | not reported | 5 |

- A separate Toast survey of 850 adults, Dec 2025, puts word of mouth at 45% and online sources at 33%. [Toast](https://pos.toasttab.com/blog/data/how-guests-discover-new-restaurants) [Snippet, vendor; 403 on open]
- Operators see it differently: 30% of owners name third-party delivery as their top new-customer driver. Published by DoorDash. [DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends) [Opened, vendor]

Third-party against direct:
- Preference only: 70% prefer ordering direct when given the option. [Menufy](https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders) [Opened, vendor] 58% prefer a restaurant's app or site for delivery, 29% each, and 15% would rather call, Nov 2024. [NCR Voyix via Restaurant Dive](https://www.restaurantdive.com/news/majority-customers-prefer-ordering-delivery-direct-restaurant-ncr-voyix/738397) [Opened, vendor]

Repeat share and loyalty lift, all vendor and mostly unsplit:
- About 60% of sales come from repeat guests, Olo on more than 100M guest records. Seen in a search summary, and the Chowly guide I opened does not contain it. [Chowly search result](https://chowly.com/?p=33829) [Snippet, vendor; exact page not confirmed]
- About 7% of a guest base may drive up to 50% of order volume. Loyalty enrollment moves return rate from about 7% to nearly 30%, truncated in the summary and likely self-selected. [Toast retention page](https://pos.toasttab.com/blog/data/restaurant-customer-retention) [Snippet, vendor; 403 on open]
- Members visit 22% more a year, attributed to Circana 2025, and top-quartile operators get about 30% of transactions from members, Paytronix. [Search summary](https://chowly.com/?p=34773) [Snippet; exact page not confirmed] Chowly repeats 22% and 12 to 18% more spend per visit with no source. [Chowly](https://chowly.com/resources/blogs/restaurant-loyalty-programs/) [Opened, vendor]
- 66% of consumers order more from restaurants where they actively use a loyalty program, and only 27% of operators know which promotions produced a repeat visit. [DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends) [Opened, vendor]
- I found no causal study of loyalty at independents.

Marketing as a percent of sales:
- Independents typically 2 to 3%, some up to 6%; chains 7 to 10%, attributed to one industry source named Makris. [Pizza Today](https://pizzatoday.com/?p=131994) [Snippet; 403 on open]
- 3 to 6% is the common rule of thumb. It is repeated by a vendor and by a consultant, and neither reports a survey. [Sauce](https://www.getsauce.com/post/2025/04/02), [FSR search result](https://www.fsrmagazine.com/feature/how-much-money-should-you-spend-marketing-your-restaurant) [Snippet]
- Conflict: a 2016 FSR expert piece advises 12 to 18% for established restaurants and 25 to 35% for new ones, links a seller's budget calculator and cites no restaurant data. [FSR, Sept 2016](https://www.fsrmagazine.com/expert-takes/how-much-money-should-you-spend-marketing-your-restaurant) [Opened; treat as sales advice]

### Inferences
- Mine: Toast's search 16% plus map apps 18% equals Menufy's Google 34%. That may be coincidence, since these are different samples, but it suggests reporting Google search and Maps together at about a third.
- Mine: Menufy says 5% of consumers use delivery apps and DoorDash says 30% of owners name them top. Each publisher sells one side, and the two measure different things, so quote both with the publisher named.
- Mine: at 2.8% median full-service margin from the earlier note, a 12 to 18% budget would exceed profit several times over. It is not a usable benchmark for an independent.

### Gaps
- Not found: actual share of orders by channel at independents. A figure of 62% of digital orders being direct appeared in a search summary with no clear method, so I leave it out.
- Not found: independent-only repeat guest share.
- [L.E.K. on delivery](https://www.lek.com/insights/digital-restaurant-delivery) returned 404.

## Catering, private events, large parties and group orders

### Takeaway
Inquiries arrive scattered across phone, general inbox, web form, Yelp and Instagram. The person answering is also running the shift. Reply time is 24 to 72 hours by one vendor founder's estimate, with no sample, and no source reports measured frequency per independent. Owner accounts confirm the shape and give few numbers.

### Cited findings
How inquiries arrive:
- Private events: general inbox, where they can sit, per the Reunion founder. [Modern Restaurant Management](https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/) [Opened, vendor]
- Four or five channels: web form, Yelp message, general manager's email, Instagram DM, voicemail. [US Tech Automations](https://ustechautomations.com/resources/blog/automate-route-privateevent-inquiries-by-date-and-headcount-2026) [Snippet, vendor; exact page not confirmed]
- Older clients phoned requests in, one Georgia owner recalled. [Statesboro Herald](https://statesboroherald.com/local/business/catering-helps-boro-restaurants-boost-bottom-line) [Opened]

Frequency:
- Modeled: 5 to 10 quote requests a month for one vendor's chamber-member case, with 40 to 60% conversion if answered in 24 hours. Nothing is measured. [EatLocally](https://eatlocally-pages.pages.dev/blog/inbound-catering-without-changing-operations) [Opened, vendor]
- Illustrative: 10 orders a month, $360 each. ChowNow's own arithmetic is wrong: it claims about $5,600 a year in commission savings when its inputs give $4,320, mine. [ChowNow](https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/) [Opened, vendor]
- Illustrative: 42 a month for a 200-seat restaurant in peak season, and 50 a week with an 18% booking rate at a 5-hour reply. Same vendor family, modeled, and it conflicts with the others. [US Tech Automations](https://ustechautomations.com/resources/blog/route-catering-inquiries-by-party-size-and-date-vs-2026) [Snippet, vendor]
- Demand side: 80% of companies order catering monthly and 32% weekly, linked to ezCater, plus 20% of catering customers being repeat. [Lunchbox](https://lunchbox.io/25-catering-stats-to-know-in-2025) [Opened, vendor; source named only in link]
- Office orders cluster Tuesday through Thursday, and ezCater hears from about 250 small restaurants a week. [Restaurant Dive, Jan 2024](https://www.restaurantdive.com/news/return-to-office-fueling-restaurant-catering-growth-outlook-2024/705757/) [Opened]

Value:
- Pre-opening catering orders at $1,000 to $5,000 at World Wrapps, 6 units. [NRN, Nov 2024](https://www.nrn.com/restaurant-operations/small-chains-and-independents-ramp-up-their-catering-programs) [Opened]
- $350 average ticket against $35 at mealtime. [NRN](https://nrn.com/node/436278) [Snippet] This matches the earlier notes' $360 to $420.

Owner accounts:
- Baltimore: Isabella's owner Dan Stewart put catering at about 25% of revenue. Local and relevant, but date unknown. [Restaurant Business](https://www.restaurantbusinessonline.com/food/restaurants-ramp-catering-programs-demand-returns) [Snippet; 403 on open; exact article not confirmed]
- Statesboro, Georgia, about 2018: Vandy's average job serves 100 or fewer, with occasional 200-plus, and existing kitchen staff cook it. The Beaver House owner and son handle catering themselves and treat it as a bonus. Barberitos saw growth every month after opening. No shares or counts. [Statesboro Herald](https://statesboroherald.com/local/business/catering-helps-boro-restaurants-boost-bottom-line) [Opened]

Who answers and reply time:
- Managers forward inquiries to each other, and the person building proposals also runs daily operations. Most restaurants reply in 24 to 72 hours. Proposals take one to three days from scratch. Follow-up is often one email a week later or none. This is a vendor founder's description with no sample. [Modern Restaurant Management](https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/) [Opened, vendor]

### Inferences
- Mine: owners who treat catering as a bonus will not open an app for it. The card has to reach them where they already are, and the first test with an owner should ask how many inquiries arrived last month.
- Mine: reply speed may matter less than proposal speed. A sub-minute acknowledgement still leaves a one to three day quote gap, and that gap is what standard packages or a code-computed quote would close.

### Gaps
- Not found: measured inquiries per month, close rate, or reply time at independents. Owner-reported numbers from r/restaurantowners were not reachable.
- Not found: large party share or value. Only Maple's 7% combined figure exists.
- Not found: margin on catering orders.

## Follow-up: what happens today, where it leaks, and does speed pay?

### Takeaway
No measured evidence shows that a fast reply raises catering or event bookings. The evidence is stated importance, vendor claims and old adjacent mystery-shop data. The best-supported leak is unanswered reviews at single-location restaurants, from one vendor count, and half of consumers dislike templated replies, which bears directly on AI drafts.

### Cited findings
Leak table. The fix column is vendor advice where linked, and mine otherwise.

| Leak point | What happens today | Evidence | Fix |
|---|---|---|---|
| Missed call | 6.9% to 40.1% missed by segment, about 33% at peak self-reported, per earlier notes | Vendor only: [Revmo](https://revmo.ai/guides/state-of-calls-report), [Maple](https://maple.inc/blog/the-state-of-restaurant-phone-communication-insights-from-1-million-calls.md), earlier note | Text-back drafted from the call log, mine. Recovery rate not found |
| Catering or event email | Sits in shared inbox, forwarded, 24 to 72 hours, one follow-up or none | [Reunion founder](https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/) [Opened, vendor] | Substantive reply within two business hours, three to five standard packages, touches at day 1, day 3 and week 1, then stop |
| Web form | Scenario: arrives during lunch, waits until the next morning. Not measured | [Search summary of vendor pages](https://ustechautomations.com/resources/blog/restaurant-catering-booking-automation-pain-solution-2026) [Snippet, vendor] | Automatic received note plus owner alert. [Tripleseat](https://tripleseat.com/blog/streamlining-your-event-inquiry-process-best-practices-to-remove-friction-for-planners/) [Snippet, vendor] |
| Instagram DM | Vendor says unanswered for a few hours means booked elsewhere. No measurement | [InstantDM](https://instantdm.com/for/restaurants) [Snippet, vendor; exact page not confirmed] | Route event keywords to a card, mine. Not found: any restaurant DM volume or reply rate |
| Review | Single-location response rate steady near 15%; chains rose from about 30% in early 2021 to nearly 60% | [RightResponse, 100,000+ reviews](https://rightresponseai.com/blog/100000-restaurant-reviews) [Snippet, vendor; 403 on open] | Draft reply for approval. 80% prefer businesses that reply to all reviews, and 50% are put off by generic replies. [PinMeTo on BrightLocal](https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/) [Opened, secondary] |
| Lapsed regular | Often invisible: only 27% of operators know which promotions produce repeats | [DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends) [Opened, vendor] | 30 to 60 day trigger with three touches. [Vendor page](https://restaurant-ghl-snapshot.pages.dev/blog/win-back-lapsed-diners) [Snippet, vendor]. Its 15% win-back is hypothetical |
| Abandoned online order | Text benchmark: 10.1 to 14.2% click-through, 17.4 to 31.6% conversion, $3.46 to $10.05 a message. A claim of 70%+ abandonment credited to Baymard is unconfirmed | [Rezku search result](https://rezku.com/blog/how-restaurants-use-text-marketing/) [Snippet, vendor; exact page not confirmed] | First message in 15 to 30 minutes, only on owned ordering. TCPA consent needed. [Search summary](https://orders.co/blog/top-restaurant-email-marketing-strategies/) [Snippet, vendor; exact page not confirmed] |

Does a fast reply raise bookings?
- Stated importance only: 77% of consumers rate venue responsiveness as very or extremely important (42% and 35%), sample not stated. The same page's claim that 30 minutes can lose a booking has no source. It recommends a reply within one hour. [Tripleseat, Jul 2025](https://tripleseat.com/blog/venue-responsiveness-reigns-supreme-why-lightning-fast-communication-is-your-venues-secret-weapon/) [Opened, vendor]
- Unverified: 4 to 5 times conversion when replying in the first minute. [Rookoo](https://www.rookoo.ai/blog/rookoo-tripleseat-integration) [Snippet, vendor] 100 times connection at five minutes, no source. [InnDojo](https://inndojo-com.pages.dev/blog/tripleseat-losing-leads) [Snippet, vendor]
- Unverified: slow response loses 30 to 40% of bookings, credited to CatererSource. [Conferbot](https://www.conferbot.com/blog/catering-chatbot-guide) [Snippet, vendor]
- Adjacent and old: 3,000+ test calls to 750+ hotel group sales offices found a sales manager reachable on 49.4% of calls, and messages unanswered by end of next business day more than 51.7% of the time. No booking data. [Quality Track, 2007](https://www.hospitalityupgrade.com/news/blowing-the-basics-hotel-sales-managers-fail-to-respond-to-customer-inquiries-more-than-25-of-the-time) [Opened, vendor, hotels only]
- Adjacent: 28% of group sales inquiries lost or ignored. [Special Events](https://specialevents.com/node/26304) [Snippet; the URL redirected elsewhere and is unverified]
- Mystery-shop studies of restaurant email reply rates: not found. Other trades show low rates, such as 50% in franchising and an old 42% at auto dealers. [Franchising.com](https://www.franchising.com/articles/mystery_shopping_24_researchers_investigate_first_contact_with_potential_fr.html), [F&I Magazine](https://www.fi-magazine.com/312039/poor-e-mail-response-may-be-causing-dealers-to-lose-sales-leads-j-d-power-report) [Snippet]

### Inferences
- Mine: "a personal reply in under a minute lifts bookings" cannot be stated as fact for restaurants. The defensible wording is that planners say speed matters and slow replies are common by vendor account. A pilot logging reply time against booked or not would be new evidence.
- Mine: the 50% templated-reply dislike means drafts must cite a detail from the review or inquiry. Approval alone does not solve it.
- Mine: lapsed-guest and abandoned-order flows need captured contacts and owned ordering, so they fail for cash-heavy, app-only or no-POS shops. They are not first-card material for a family restaurant.

### Gaps
- Not found: any measured catering or event conversion by reply time, vendor or otherwise, with a disclosed method.
- Not found: unanswered negative review share at independents, and missed-call recovery rates.
- General lead-response research such as the 2011 HBR study was not checked in this run, and it would not be trade-specific anyway.

## Corner stores step by step, and lead-like events

### Takeaway
A corner store sells through location, habit and manufacturer-funded placement and price, with almost no owner-run marketing. I found no adoption numbers for Google listings or text orders. Lead-like events exist at the deli end and among tabs, but the only evidence for single-store independents is anecdote.

### Cited findings
- Location and habit: see the Bronx and Baltimore figures in the first section.
- Signage, shelf and window: earlier notes' 318-store field study found manufacturers dictate near-identical layout and signage. Cigarette makers spent $8.01B on advertising and promotion in 2022, of which $5.74B went to retailer price discounts and $1.14B to wholesalers, 85.9% combined. [FTC, Oct 2023](https://www.ftc.gov/news-events/news/press-releases/2023/10/ftc-releases-reports-cigarette-smokeless-tobacco-sales-marketing-expenditures-2022) [Opened] Payments for stocking, shelving and display were $247.2M. [FTC 2022 report](https://www.ftc.gov/system/files/ftc_gov/pdf/2022-Cigarette-Report.pdf) [Snippet] Not split by chain or independent.
- Manufacturer programs: tobacco rebates depend on regular scan data, with Altria's program named among the largest. Some need a direct account, others only a distributor. [Lifelong POS](https://lifelongpos.com/resources/blog/tobacco-manufacturer-rebates-pos-scan-data) [Snippet, vendor, garbled] PDI offered free scan data to single-site stores. [PDI](https://pditechnologies.com/archive/tobacco-scan-data-package/) [Snippet, vendor, date not checked] Retailers debate restrictive display allowances. [CSNews](https://csnews.com/rebate-debate) [Snippet]
- Price: earlier notes have owners pricing from wholesaler cost and following wholesaler sale items.
- Credit or tabs: one commenter said a NYC bodega still gives a tab, with the customer texting what she takes and paying weekly. Another said store credit is long gone or rare in the US. Thread on r/asklatinamerica, two comments. [Snapshot](https://reddit.sentinel-team.org/posts/1sr4sfy/snapshots/2026-04-21T06%3A15%3A38.640218Z) [Opened, anecdote, third-party snapshot of unverified reliability] A book on Dominican bodegas exists and I could not check whether it covers credit. [Krohn-Hansen](https://www.everand.com/book/262342264/Making-New-York-Dominican-Small-Business-Politics-and-Everyday-Life) [Snippet]
- Google listing: trade advice only. An NRS executive recommends a Google profile plus a directory, and another executive names cost, time and technical and marketing expertise as independents' loyalty hurdles. [CSNews](https://csnews.com/small-operators-race-keep-customer-loyalty-game) [Snippet; 403 on open]
- Delivery: the bodega association's founder said in 2021 that owners could not compete with 15-minute apps and wanted city funding. He represents 2,000 bodegas. Closures were feared, with no sales figures. [CBS New York](https://www.cbsnews.com/newyork/news/grocery-delivery-apps-gorillas-new-york-city-bodegas-delis) [Opened] My Bodega Online launched in March 2020 with about a dozen stores, aimed for 1,000 in six weeks, used bodegas' own deliverers and accepted cash, and planned a fee of 50 cents a transaction. Its founder framed it as about relationships more than transactions. [Time Out](https://www.timeout.com/newyork/news/a-new-delivery-app-dedicated-to-new-york-city-bodegas-just-launched-032420) [Opened] Current store count not found.
- WhatsApp or text orders: no US evidence found. The NYU page mentions neither. WhatsApp ordering appears in Peru. [Peru Retail](https://www.peru-retail.com/peru-como-se-han-reinventado-las-bodegas-en-tiempos-de-covid-19/) [Snippet, not US]
- SNAP customers: of the 2018 Kentucky food provider survey, responses were 12% of deliverable surveys, and convenience stores were the top respondent type. [Kentucky survey](https://blueprintkentucky.mgcafe.uky.edu/files/survey_overview_pse.pdf) [Opened] 43% named the first of the month as the peak EBT day, and 21% the day benefits arrive. [Search summary of the same survey](https://blueprintkentucky.mgcafe.uky.edu/files/survey_overview_pse.pdf) [Snippet; I did not confirm these in the text] One Rhode Island owner's anecdote has a slow day of $526 before a day about 15 times larger. [The Week](https://theweek.com/articles/465647/food-stamp-nation) [Snippet, older]
- Lead-like events at small chains: Breez-In and Huck's in the first section. Wawa's chainwide program was store-level with 24 to 48 hour lead time, and it later moved to ezCater. [CSP](https://cspdailynews.com/foodservice/wawa-taking-catering-chainwide) [Snippet; 403 on open] A consultant says a store needs a solid fresh-food offering before catering. [CSP Kitchen](https://cspdailynews.com/csp-magazine/csp-kitchen-can-c-stores-cash-rising-catering-sales) [Snippet; 403 on open]

### Inferences
Mine, the corner store sequence: location and hours draw the customer; manufacturer signage and pricing set the offer; the owner sets remaining prices from wholesaler cost; a known face, and in some stores a tab, builds habit; SNAP timing sets the monthly rhythm; a delivery app or POS tie-in adds orders where it exists.

- Mine: the tobacco money means the "marketing department" is a manufacturer contract, and it is tied to scan data. With 42% of independents on old registers in the earlier note's field count, many stores may miss that money. A check of "which programs could you qualify for" is a possible card, but no source measures unclaimed money.
- Mine: first-of-month timing could schedule buying cards, a more natural trigger than a lead.
- Mine, the lead-like list for single-store owners, none measured: deli platters, party or holiday orders, phone orders from regulars, office or nearby-business accounts, tabs.

### Gaps
- Not found: share of independents with a claimed Google listing, with a deli, offering catering, or running tabs; phone calls per day; text or WhatsApp order share; office accounts; bulk orders. Owner interviews are the fastest route, and a Google Maps sample of Baltimore stores would add a small original number.
- [PMC5730500](https://pmc.ncbi.nlm.nih.gov/articles/PMC5730500) and CSP pages blocked me, and C-store forums were not reached in this run.

## Who does marketing, how many hours, and how do owners decide spend?

### Takeaway
The owner or a manager does it in spare time. The one number is 3.7 hours a week from Canada in 2019. No current US survey measures hours or who does the work, and I found no source on how owners actually decide spend.

### Cited findings
- 3.7 hours a week on marketing among restaurant owners, 52% with a website and 72% using social marketing. Vistaprint survey of 1,000 Canadian small business owners, 2019. [Menu Magazine](https://menumag.ca/2019/09/26/the-digital-landscape-restaurant-owners-invest-in-social-media-more-than-their-website/) [Opened, vendor, Canada]
- 12% of restaurants and caterers hire someone for social media, and 58% do not invest in it. Date likely about 2011, which is my guess. [Restaurant Hospitality](https://www.restaurant-hospitality.com/node/4334) [Snippet, old]
- 77% spend at least three hours a week on social, method unknown. [Coyle Hospitality](https://coylehospitality.com/blog/does-your-restaurant-have-time-for-social-media/) [Snippet]
- 245 US small business owners, not restaurant-specific: those spending 6 to 10 hours a week were nearly 6 times likelier to call marketing effective than those spending 1 to 5. [Barchart](https://www.barchart.com/story/news/1589890/4-in-5-small-business-owners-say-their-marketing-barely-works-new-research-points-to-why) [Snippet, vendor; page opened empty]
- 68% of restaurateurs had limited budgets and 49% had trouble tracking return, LivingSocial 2015. [Hospitality Tech](https://hospitalitytech.com/tracking-roi-and-loyalty-top-marketing-concerns-restaurants) [Snippet, vendor, old] 68% plan to raise budgets in 2026, with social valued by 68% and email by 41%, original survey not located. [Pulse](https://www.pulse.bot/hotels/news/doubling-down-on-restaurant-marketing-spend-d6b7892e-1456-4593-91ff-380651f535e8/) [Snippet, unverified]
- 40% of operators run 4 to 5 separate systems. [DoorDash and SevenRooms](https://merchants.doordash.com/blog/restaurant-industry-trends) [Opened, vendor]
- The James Beard page gives no marketing, loyalty, catering or repeat figures in the public summary, and 49% of chefs rank social media as a top 2026 trend. Full report gated. [JBF](https://www.jamesbeard.org/impact/research-and-reports/2026-independent-restaurant-industry-report) [Opened]

### Inferences
- Mine: with 3.7 hours and thin budgets, a good pitch for approve-only marketing is time returned plus visible attribution, since only 27% can tell which promotion worked.
- Mine: for corner stores, marketing hours are probably near zero, because manufacturers fund placement and price. No source measures this.

### Gaps
- Not found: US owner hours on marketing, split of owner, manager, family or agency, and how owners decide spend. All marketing-spend guidance comes from people selling marketing.
- Corner store marketing hours, budget, and who does it: not found.
- Reddit: `old.reddit.com` was refused by the fetch tool, and search returned no r/restaurantowners, r/smallbusiness or r/KitchenConfidential threads. Search did return third-party snapshots of two threads, r/asklatinamerica (used above) and r/BBQ, whose comments did not cover catering. RestaurantOwner.com threads did not appear. The [Square Community page I tried](https://community.squareup.com/t5/Square-for-Restaurants/ct-p/restaurant) returned 404. Owner voice stays thin, and someone should read these forums by hand.

## URLs opened

Content read:
1. https://restaurant.menufy.com/article/5-things-costing-your-restaurant-orders
2. https://www.pmq.com/how-are-guests-discovering-new-restaurants-this-national-survey-has-answers/
3. https://merchants.doordash.com/blog/restaurant-industry-trends
4. https://www.pinmeto.com/news/brightlocal-local-consumer-review-survey-2026/
5. https://modernrestaurantmanagement.com/why-most-restaurants-leave-private-event-revenue-on-the-table/
6. https://tripleseat.com/blog/venue-responsiveness-reigns-supreme-why-lightning-fast-communication-is-your-venues-secret-weapon/
7. https://eatlocally-pages.pages.dev/blog/inbound-catering-without-changing-operations
8. https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/
9. https://www.hospitalityupgrade.com/news/blowing-the-basics-hotel-sales-managers-fail-to-respond-to-customer-inquiries-more-than-25-of-the-time
10. https://www.harvardmagazine.com/2011/10/hbs-study-finds-positive-yelp-reviews-lead-to-increased-business
11. https://menumag.ca/2019/09/26/the-digital-landscape-restaurant-owners-invest-in-social-media-more-than-their-website/
12. https://www.cstoredive.com/news/how-c-stores-are-ideal-for-catering-foodservice/693290/
13. https://www.restaurantdive.com/news/majority-customers-prefer-ordering-delivery-direct-restaurant-ncr-voyix/738397
14. https://www.restaurantdive.com/news/return-to-office-fueling-restaurant-catering-growth-outlook-2024/705757/
15. https://www.restaurantdive.com/news/restaurant-gift-card-sales-up-17-percent-during-thanksgiving-weekend-paytronix/735960/
16. https://www.nrn.com/restaurant-operations/small-chains-and-independents-ramp-up-their-catering-programs
17. https://steinhardt.nyu.edu/news/online-food-shopping-exploded-during-covid-19-pandemic-can-it-catch-bodegas
18. https://www.cbsnews.com/newyork/news/grocery-delivery-apps-gorillas-new-york-city-bodegas-delis
19. https://www.timeout.com/newyork/news/a-new-delivery-app-dedicated-to-new-york-city-bodegas-just-launched-032420
20. https://www.ftc.gov/news-events/news/press-releases/2023/10/ftc-releases-reports-cigarette-smokeless-tobacco-sales-marketing-expenditures-2022
21. https://statesboroherald.com/local/business/catering-helps-boro-restaurants-boost-bottom-line
22. https://lunchbox.io/25-catering-stats-to-know-in-2025
23. https://chowly.com/resources/blogs/restaurant-loyalty-programs/
24. https://www.fsrmagazine.com/expert-takes/how-much-money-should-you-spend-marketing-your-restaurant
25. https://www.jamesbeard.org/impact/research-and-reports/2026-independent-restaurant-industry-report (public summary only)
26. https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf (text extracted, chart labels partly broken)
27. https://admin.institute.org/wp-content/uploads/2011/06/Corner_Store_Purchases_in_a_Low-income_Urban_Community_in_NYC.pdf (text extracted, first pages and tables read)
28. https://blueprintkentucky.mgcafe.uky.edu/files/survey_overview_pse.pdf (text extracted, sample lines only)
29. https://reddit.sentinel-team.org/posts/1sr4sfy/snapshots/2026-04-21T06%3A15%3A38.640218Z (third-party snapshot)
30. https://reddit.sentinel-team.org/posts/1pj9cuv/snapshots/2025-12-10T23%3A21%3A24.918699Z (third-party snapshot, not useful)

Tried, no usable content:
- 403: pos.toasttab.com pages, csnews.com, pizzatoday.com, restaurantbusinessonline.com, cspdailynews.com, rightresponseai.com
- 404: lek.com, tripleseat.com/?p=22548, community.squareup.com
- Refused by the fetch tool: old.reddit.com
- Captcha: pmc.ncbi.nlm.nih.gov
- Login redirect, not followed: read.qxmd.com
- Off-site redirect, not followed: specialevents.com
- No body returned: brightlocal.com survey pages (2026 and 2023), barchart.com
