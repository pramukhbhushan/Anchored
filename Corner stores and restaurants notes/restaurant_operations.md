# How independent US restaurants actually run: the owner's week and money

Checked Nov 6, 2026. Tags: `[opened]` means I read the page or PDF text. `[snippet]` means I saw it only through a search summary, so open it before relying on it. `[vendor]` means the publisher sells a fix for the problem it measures. `[secondary, not reopened]` means the figure comes from another research note that links this source, and I did not reopen the page. `[secondary, source not reopened]` means the same, with no source link available. Owner quotes are paraphrased. Almost no dataset splits independents from chains, and each section says when one does.

## 1. How many independents exist, and what are unit revenue, margins, prime cost and failure rates?

### Takeaway
About 412,000 US independents remain, roughly 61% of units, and they shrank 2.3% in 2025 while chains grew. Median pre-tax margin is 2.8% for full service and 4.0% for limited service, so on $1M of sales one point of food cost is worth about a third of the profit. No source gives a Maryland independent count or a median independent unit revenue.

### Cited findings
- Technomic counted 412,498 independents at year-end 2025, down from 422,001, a net loss of more than 9,500. Full-service independents fell 2.6% and limited-service independents 1.8%. Chain units rose 1.4% to more than 263,000. Figures are preliminary. [NRN](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025) `[opened]`
- Top 500 chains hold about 239,538 locations, about 35% of the industry. [Restaurant Business](https://www.restaurantbusinessonline.com/article/top-500-2026) `[snippet]`
- 7 in 10 restaurants are single-unit and 9 in 10 have fewer than 50 employees. The page is undated. [NRA statistics](https://restaurant.org/research-and-media/research/industry-statistics/national-statistics) `[snippet]`
- Maryland, 2025 data: 11,946 eating and drinking establishments, 201,000 employees in them, 256,100 restaurant and foodservice jobs, $24.3B in sales, third-largest private employer. [NRA Maryland fact sheet](https://www.restaurant.org/research-and-media/research/industry-statistics/maryland-state-fact-sheet) `[opened]`
- Median pre-tax income was 2.8% of sales for full service in 2024, down from 4% in 2019, and 4.0% for limited service, down from 6%. The base is a survey of more than 900 owners, and the public summary does not split chains from independents. [NRA State of the Restaurant Industry 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- 42% of operators reported no profit in 2025. The same report's opening letter says 45%, an internal conflict. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]` NRN repeats 42% and adds that 60% said conditions worsened and 15% said they improved. [NRN](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025) `[opened]`
- Independent owners specifically: a James Beard Foundation and Deloitte survey of more than 380 owners, chefs and operators in 47 states found that those who raised prices more than 10% were the most likely to expect lower profits. The full report is gated. [JBF 2026 report](https://www.jamesbeard.org/impact/research-and-reports/2026-independent-restaurant-industry-report) `[opened summary]`
- Failure: 17% of independently owned full-service startups failed in year one, against 19% for other service startups. Median life was about 4.5 years, and 3.75 years for startups with 5 or fewer employees, against 4.0 for comparable service firms. This is BLS microdata for about 81,000 western US restaurants over 20 years. It is older, from 2014, and it refutes the "9 in 10 fail" myth. [Luo and Stark](https://arxiv.org/abs/1410.8603) `[opened abstract]`
- POS context: Baird sizes the US restaurant and bar market at about $1.1T, with businesses below the top 250 at about 75% of it. [Restaurant Dive](https://www.restaurantdive.com/news/toast-clover-battle-for-small-eateries/809137/) `[opened]`

### Inferences
- My calculation: 412,498 of about 675,500 units is 61% independent.
- Maryland independents, inferred, not measured: applying 61% to 70% to 11,946 gives roughly 7,300 to 8,400.
- Maryland averages about 17 employees per eating and drinking place (201,000 / 11,946, my calculation).
- Revenue anchors, none of them a median independent. Toast's Q3 2026 payment volume of $61.8B across about 189,000 locations annualizes to about $1.3M in card volume per location, my calculation from [Toast 8-K](https://www.sec.gov/Archives/edgar/data/0001650164/000165016426000214/tost-20260930xexhibit991.htm) `[opened]`. Toast's own survey splits "larger" and "smaller" operators at $1M. Treat $1M as a modeling round number and assume cash-heavy family shops sit below it.
- 4.5 years is a median life for startups in old western data, so the takeaway is "about half are gone by year five," not "nearly all fail."

### Gaps
- Median independent unit revenue. The 2022 Economic Census has receipts per establishment by NAICS 722511, 722513 and 722515, but the Census API required a key and the BizBuySell benchmarks returned 403. Pull from [the Sector 72 tables](https://www.census.gov/data/tables/2022/econ/economic-census/naics-sector-72.html) if needed.
- Prime cost median. The number sits in NRA's paid Operations Data Abstract. Third-party pages quoting about 68 to 69% for full service could not be traced to it, so I leave that figure out.
- No Maryland independent count and no recent national gross closure rate. Technomic's 2.3% is net of openings.

## 2. Which chores take the owner's time?

### Takeaway
No time diary of independent owners exists. The best measured figure is 3.7 hours a week on scheduling and 8 to 10 hours on scheduling plus admin for managers, from a vendor. The owner voice I could reach, mainly NRA's delivery quotes, JBF and one news interview, is about delivery apps, costs and tool overload. That sample is narrow, so it does not show which chore takes the most time.

### Cited findings
Measured or estimated hours, all vendor:
- Managers lose 8 to 10 hours a week to scheduling and admin, and scheduling alone averages 3.7 hours. [Harri via QSR Magazine](https://www.qsrmagazine.com/story/why-ai-scheduling-has-become-a-restaurant-necessity/) `[snippet, vendor]`
- Managers spend 3 to 10+ hours a week on scheduling. [Legion](https://legion.co/2025-state-of-the-hourly-workforce-report-early-sign-up/) `[snippet, vendor]`
- About 10 hours a month per location go to reviewing delivery claims, an Otter estimate. [Otter](https://www.tryotter.com/resource/guides/the-state-of-restaurant-delivery-errors-fraud-2026) `[opened, vendor]`
- Claims of 15 to 25 admin hours a week cite 7shifts and Crunchtime without a link, and the search results flagged them as unverifiable. I do not use them.

What operators report, not in hours:
- Share saying technology had a significant impact in the last 2 to 3 years, full service then limited service: on-premises ordering 58/67, marketing 56/64, back office 56/53, scheduling 48/50, inventory 38/40, recruiting 28/40, reservations and inquiries 43/8. My reading of a broken PDF text layer, so check the chart. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- Toast's top operational challenges, from 676 operators with 16 or fewer locations in April 2026: inflation 27%, hiring 22%, foot traffic 15%, managing finances 15%, throughput 14%, marketing 14%, cost-of-goods analysis 14%. Top labor plans: staff speed 51%, retention 49%, optimizing shift scheduling 45%. [Toast via Stacker](https://keyt.com/stacker-business-economy/2026/09/26/survey-how-us-restaurants-are-handling-inflation-labor-ai-and-revenue-growth/) `[opened, vendor]`
- Reviews: 89% of consumers expect owners to respond. [BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey/) `[secondary, not reopened]`

Owner voice:
- Independent quickservice and casual dining operators told NRA that apps are costly, give no control after the order leaves the kitchen, and take forever to resolve problems. Others called apps their marketing arm and a way to reach late-night and young customers. One independent fine dining operator from California: "Third-party delivery drivers get the tips instead of my staff." [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- A restaurant owner said one cost increase added a couple of points to his food cost, worth tens of thousands of dollars. [KERO](https://www.turnto23.com/politics/economy/restaurants-struggling-to-stay-profitable-as-costs-squeeze-already-slim-margins) `[opened]`
- Shift swaps in group texts: only vendor pages describe staff agreeing swaps by text without telling a manager. [Shyft](https://www.myshyft.com/?p=197432) and [7shifts](https://www.7shifts.com/blog/best-shift-swap-app-for-restaurants/) `[snippet, vendor]`
- One blog argues the hard part of scheduling is human knowledge such as availability and who should not work together, which limits AI. [Bhattacharya](https://sagnikbhattacharya.com/blog/ai-time-savings-small-restaurant) `[snippet, low authority]`

### Inferences
- Hours are manager hours at firms that buy scheduling software. A single-unit owner working a station does these tasks at night in fragments, so I expect fewer logged hours and more lost attention. No source tests that.
- Rough order of frequency for an owner, inferred: daily ordering and receiving, cash-out, messages and staff gaps; weekly schedule, invoices and payroll inputs; irregular reviews, app disputes, menu and price updates, hiring; rare but costly inspections and wage claims.

### Gaps
- Reddit was unreachable: the search tool refused reddit.com. r/restaurantowners voice is not in these notes. Someone needs to read it by hand.
- No measured hours for invoices, phone calls, reviews, menu updates, hiring or inspection prep at independents. Treat any figure from an AI vendor blog as marketing.
- No survey on group chat use for staff scheduling at independents.

## 3. What is the dollar size of each leak?

### Takeaway
On a model $1M restaurant, the largest recurring leaks are food cost drift, delivery commissions and turnover, each in the tens of thousands of dollars or close to it. Delivery disputes and no-shows are smaller. Missed calls have no non-vendor number, and the honest answer depends on whether the shop gets calls at all.

### Cited findings
Missed calls and phones, all vendor. I found no academic or government study.
- Revmo, 12,091 call recordings: miss rates of 40.1% QSR, 24.8% fast casual, 9.0% full service and 6.9% pizza. It claims about $73,000 a year lost per QSR location, with no inputs shown and no chain or independent split. Full-service callers wait an average of 73 seconds on hold. [Fast Casual](https://www.fastcasual.com/news/new-study-reveals-revenue-gaps-from-missed-calls/) `[opened]`, [Revmo](https://revmo.ai/guides/state-of-calls-report) `[opened, vendor]`, [Revmo PDF](https://wp.revmo.ai/wp-content/uploads/2026/04/REVMO_STATE-OF-CALLS-REPORT-2026-SS.pdf) `[snippet for the 9.0%]`
- Maple, about 1.2M calls at 1,000+ locations, Dec 2023 to Nov 2025. Call mix: reservations 38%, hours and location 22%, menu questions 15%, takeout and delivery orders 12%, event or large party 7%, reservation changes 4%, other 2%. 68% of calls land 11am to 2pm or 5pm to 9pm. Merchants estimated missing about 33% of calls at peak, self-reported before buying. Maple says its users may not represent all restaurants. [Maple](https://maple.inc/blog/the-state-of-restaurant-phone-communication-insights-from-1-million-calls.md) `[opened, vendor]`
- Hostie: 36% missed at peak before install, and a July 2025 consumer survey where 69% say they would likely give up on a restaurant that does not answer. [Hostie study](https://www.hostie.ai/resources/hostie-ai-500k-call-study-missed-calls-reduction), [Hostie survey](https://hostie.ai/blogs/missed-connection-over-two-thirds-of-americans-would-ditch-restaurants-that-dont-answer-the-phone) `[snippet, vendor]`

Delivery:
- 62% of limited-service and 40% of full-service operators offer delivery. Third-party ordering is available at 53% and 34%. 69% say delivery creates more opportunity and 31% more challenge, rising to 37% for full service. Those who see a challenge cite fees, chargebacks and lost control. Delivery is 9.6% of full-service traffic and 12.4% of limited-service traffic in 2025; takeout is 25.2% and 43.6%. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- Commissions: vendor guides put tiers at 15 to 30% of subtotal, with small operators mostly at 25 to 30%. I found no official 2026 rate card. [Sauce](https://getsauce.com/post/doordash-vs-uber-eats-for-restaurants), [Unplug](https://unplugdining.com/blog/the-true-cost-of-doordash-and-uber-eats-commissions-in-2026) `[snippet, vendor]`
- Errors: 3.5% of orders flagged and 2.5 to 3% of delivery revenue caught in disputes, the latter credited to Restaurant Business 2024. Otter's data covers 9,341 locations across national chains, so it does not describe independents. Its $1.8B national loss has no stated source, so I do not use it. [Otter](https://www.tryotter.com/resource/guides/the-state-of-restaurant-delivery-errors-fraud-2026) `[opened, vendor]`

Food cost:
- Food costs run more than 35% above pre-pandemic on the BLS PPI. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]` 82% of operators reported higher food costs in 2025. [NRN](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025) `[opened]`
- Vendors define variance and name unrecorded supplier price rises as a cause, but publish no measured price creep. [MarginEdge](https://www.marginedge.com/blog/a-restaurant-operators-guide-to-actual-vs-theoretical-food-costs-and-usage), [Toast](https://pos.toasttab.com/blog/on-the-line/food-cost-variance) `[snippet, vendor]`

No-shows, all vendor:
- Resos: 2.33% across 3.77M reservations at 2,417 restaurants, 0.80% with a deposit or card hold against 2.47% without. Not US-only as far as I can tell. [Resos](https://resos.com/restaurant-no-show-rate/) `[snippet]`
- Bloom: 3.7% no-show and 15% cancelled, average seated check about $165. [Bloom](https://bloomintelligence.com/blog/restaurant-no-shows/) `[snippet]`
- OpenTable UK: £55.70 for a no-show table of two, and UK no-shows fell 6% year on year. [Restaurant Online](https://www.restaurantonline.co.uk/Article/2026/10/06/no-show-rates-fall-year-on-year-report-finds/) `[opened]`
- "10 to 20%" figures circulate on blogs with no primary source. Leave them out.

Turnover:
- Hard cost per replacement in 2025: about $2,706 hourly, $11,940 manager, $17,651 general manager. Industry-wide, not independent. [Black Box](https://blackboxintelligence.com/blog/state-of-the-restaurant-workforce-employee-turnover/) `[snippet, data vendor]`
- Accommodation and food services quits ran 3.5% a month in August 2026. [BLS](https://www.bls.gov/opub/ted/2026/quits-rate-3-5-percent-in-accommodation-and-food-services-august-2026.htm) `[secondary, not reopened]`
- Understaffing conflict: NRA says 22% lacked enough staff in Q4 2025, down from 78% in 2021. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]` JBF says 49% of independents report some level of insufficiency. [JBF](https://www.jamesbeard.org/impact/research-and-reports/2026-independent-restaurant-industry-report) `[opened summary]` The questions differ, and the independent-only figure runs higher.

### Inferences
Illustrative model, my arithmetic on a $1M restaurant with 17 staff, not measured. Profit is $28,000 full service or $40,000 limited service.

| Leak | Math | Yearly size | Recoverable by software? |
|---|---|---|---|
| Food cost drift | 1 point of sales | $10,000, or 36% of full-service profit | Partly: catch price rises, then the owner must act |
| Delivery commission | 10% of sales through apps at 25% | $25,000 | Only by moving orders direct |
| Delivery disputes | 2.5 to 3% of $100,000 | $2,500 to $3,000 | Partly, with a win rate no one has measured at independents |
| Turnover | 17 staff x 42% annualized quits x $2,706 | About $19,000 | Weak, since software does not stop quits |
| Missed catering lead | 1 a month x $390 | About $4,700 in sales, not profit | Yes if inquiries exist; frequency is assumed |
| No-shows | 5,000 reservations x 3% x $165 | About $25,000 in sales before walk-in refill | Reservation venues only; deposits work |

- Food cost and commissions dwarf disputes. An app-dispute agent is easy to sell and small in dollars.
- Vendor miss rates and vendor dollars point opposite ways by segment: QSR misses the most, full service the least, yet reservation and event calls are worth more.

### Gaps
- Call volume per independent location per day. No non-vendor miss rate. Without volume, every missed-call dollar figure is a model.
- Measured invoice price creep and variance at independents. Measured catering inquiry loss.
- Independent-only turnover rate.

## 4. Is catering or private events the restaurant equivalent of a sales lead?

### Takeaway
Yes in structure, for the subset of restaurants that have the channel: an inquiry worth about $360 to $420, nine or ten times a takeout order, with details to collect and a quote to send. It is thinner than a lead in a service trade that runs on inbound leads, because frequency is unmeasured, and marketplaces and AI phone vendors already handle part of it. How fast independents answer has not been measured anywhere I could find.

### Cited findings
Value:
- ezCater's 2025 report: average order value up 12% to $420 and average headcount 25, with more than 2,300 respondents including 669 restaurant operators in January 2025. Restaurants with catering programs grew 5.1% in 2024, against 3.3% for all restaurants and bars per Technomic. No chain split. [ezCater release copy](https://www.silicon.co.uk/press-release/new-ezcater-data-highlights-workplace-food-as-a-key-growth-driver-for-restaurants) `[opened, vendor]`
- ChowNow: average catering order $360, 9 to 10x a takeout order. It compares its own 5% commission with ezCater's 15% on the same order, $18 against $54. [ChowNow, May 2026](https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/) `[opened, competitor]`
- ezCater's CEO described order volume and dollars as a near 50-50 split between chains and independents. [Food On Demand](https://foodondemand.com/07152026/catering-outpaces-restaurant-industry-growth/) `[snippet; direct fetch returned 403, and the exact page is unconfirmed]`
- Business catering is $19.6B to $22B across ezCater releases citing Technomic. [ezCater release](https://www.businesswire.com/news/home/20251105713262/en/) `[snippet, vendor]`
- Tripleseat's old claim of 74,000 events and nearly $150M in sales works out to about $2,000 per event, my calculation, undated and self-reported. [Tripleseat](https://tripleseat.com/?p=1955) `[snippet, vendor]`

Share of revenue:
- The "18% of gross sales at full-service restaurants with catering, per NRA" figure and "20 to 30% against 3 to 5%" appear only on vendor pages and could not be traced to NRA. Do not use them. NRA's 2026 report does not discuss catering share. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened; the only text hit for "cater" is an occupation definition]`
- One Dallas owner put catering at 10% of revenue before the pandemic, a single anecdote. [Dallas Observer](https://www.dallasobserver.com/?p=40562068) `[snippet]`
- Square's 2026 report names catering, events and takeout as increasingly meaningful revenue, with numbers gated. [Square and Pre Shift](https://squareup.com/us/en/the-bottom-line/operating-your-business/now-serving-restaurant-tech-report) `[opened]`
- Intent: 26% of operators plan new revenue streams such as catering and online ordering, 28% under $1M against 24% at $1M or more. [Toast via Stacker](https://keyt.com/stacker-business-economy/2026/09/26/survey-how-us-restaurants-are-handling-inflation-labor-ai-and-revenue-growth/) `[opened, vendor]`
- Private events: 59% of adults say they would likely attend private chef dinners at a restaurant, stated interest rather than bookings. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`

How inquiries arrive:
- Phone: 7% of calls in Maple's mix are event or large party. [Maple](https://maple.inc/blog/the-state-of-restaurant-phone-communication-insights-from-1-million-calls.md) `[opened, vendor]`
- Direct web ordering and marketplace routing. [ChowNow](https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/) `[opened]`
- Event lead forms into Tripleseat. [Tripleseat](https://tripleseat.com/blog/streamlining-your-event-inquiry-process-best-practices-to-remove-friction-for-planners/) `[snippet, vendor]`

Speed:
- Consumers: 92% want a response within 48 hours. EventUp, 2021, older. [PR Newswire](https://prnewswire.com/news-releases/consumers-reveal-event-booking-habits-and-preferences-in-new-eventup-survey-301413959.html) `[snippet]`
- Tripleseat advises replying within 24 hours and reports planners frustrated by slow replies. A case study claims 2 to 3 hours. [Tripleseat](https://tripleseat.com/blog/streamlining-your-event-inquiry-process-best-practices-to-remove-friction-for-planners/) `[snippet, vendor]`
- One vendor blog reports a 47-hour median reply and another post from the same vendor reports 3.8 hours. They conflict, and I discard both. [US Tech Automations](https://ustechautomations.com/resources/blog/restaurant-catering-automation) `[snippet]`

Already in the market:
- Hostie and Sadie both connect AI phone answering to Tripleseat to capture private event leads. [Hostie](https://hostie.ai/blogs/hostie-tripleseat-integration-for-event-booking), [Sadie](https://www.accessnewswire.com/newsroom/en/computers-technology-and-internet/sadie-integrates-with-tripleseat-to-automate-private-event-lead-c-1156396) `[snippet, vendor]`
- AI for reservations and inquiries barely exists among operators overall: my reading of the chart is 5% of all, 9% of full service, 1% of limited service. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`

### Inferences
- A draft-then-approve reply loop maps onto this: an inquiry lands, a personal reply goes out on approval, the customer answers date and headcount, and a drafted quote waits for the owner to approve. Code can compute the quote from the menu and headcount. The owner's approval matters because the quote commits kitchen capacity and food cost.
- Where it maps poorly. ezCater orders arrive already structured, so there is little to draft. Family party orders may come as a call to a known regular, so nothing passes through an inbox for an agent to see. Lead-driven service trades live on inbound leads, while most restaurants live on walk-ins, so a drafted catering task reaches the owner rarely unless the owner markets the channel.
- A stronger lead feature might pair this rare, high-value task with a frequent one, such as a drafted task flagging a price rise from a supplier receipt, so the owner has a reason to open the tool every week.

### Gaps
- Catering share of revenue at independents, inquiries per month, close rates and reply times. I found no non-vendor number for any.
- Margin on a catering order.
- ezCater's independent share, needs a Technomic or ezCater primary source.

## 5. What is the independent tech stack, and what AI is already inside it?

### Takeaway
Clover, Toast and Square together hold about half of restaurants below the top 250, and Global Payments another 11%. Toast has moved to named agents for reviews, SEO, offers and scheduling, so outside tools for those chores now compete with one inside the POS at a growing number of restaurants. Pricing for those agents was not verified. Stated AI use ranges from 26% to 86% depending on who asks and how the question is worded.

### Cited findings
POS:
- Baird, Jan 7, 2026, restaurants below the top 250: Clover about 20% with 175,000 locations, Toast about 17% with 145,000, Square 13%, Global Payments 11%. Equity research and an estimate. [Restaurant Dive](https://www.restaurantdive.com/news/toast-clover-battle-for-small-eateries/809137/) `[opened]`
- Toast had about 189,000 total locations at Q3 2026, up 21%, with 8,500 net adds and $2.5B ARR. That total includes more than Baird's small-restaurant slice and a later date. [Toast 8-K](https://www.sec.gov/Archives/edgar/data/0001650164/000165016426000214/tost-20260930xexhibit991.htm) `[opened]`
- Global Payments launched an AI POS with voice ordering. [Nasdaq](https://www.nasdaq.com/articles/global-payments-enhances-restaurant-tech-portfolio-ai-pos-launch) `[snippet]`

Number of tools:
- 28% of JBF respondents use a single technology and 29% use four or more. Those with moderate, intentional adoption report the best performance. Owners describe being overwhelmed by choices. [JBF restaurant technology](https://www.jamesbeard.org/impact/institute/restaurant-technology), [JBF report page](https://www.jamesbeard.org/impact/research-and-reports/2026-independent-restaurant-industry-report) `[opened]` This is the only independent-only figure I found.
- Multi-unit operators average six back-of-house tools. Chains, vendor-commissioned. [CrunchTime](https://www.crunchtime.com/blog/new-research-3-key-technology-benchmarks-for-multi-unit-restaurants) `[snippet]`

AI included:
- Toast Fall Release: Toast IQ Grow with SEO, Reviews and Offers agents, and Toast IQ Team with a Scheduling Agent. Toast describes itself as moving to an agentic platform where agents take on the work. [Toast 8-K](https://www.sec.gov/Archives/edgar/data/0001650164/000165016426000214/tost-20260930xexhibit991.htm) `[opened]`
- Square added AI voice ordering and cost tools in October 2025, and orders placed from ChatGPT and Claude. [Restaurant Technology News](https://restauranttechnologynews.com/2025/10/square-goes-all-in-on-restaurants-with-new-ai-voice-ordering-smarter-cost-control-and-integrated-bitcoin-banking/), [VentureBeat](https://venturebeat.com/technology/restaurants-can-now-accept-orders-placed-directly-from-chatgpt-and-claude-thanks-to-squares-new-low-fee-no-setup-integration) `[snippet]` Square also has its agent, now named Squaremates, and an Order Guide. [Block Q3 2026 letter](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm), [Square AI](https://squareup.com/us/en/ai) `[secondary, not reopened]`
- Clover: an earlier search found no first-party AI agent as of Oct 30. `[secondary, source not reopened]` I did not find one either.

Stated use:
- NRA: 26% of operators use AI-related tools. Top uses: marketing 17%, admin 10%, menu optimization 7%, scheduling 7%, ordering 6%, hiring 6%, inventory 6%. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- Toast: about 86% are experimenting, 42% only through vendors, 19% alone, 25% both, and 2% are not considering it. Panel with incentives, blind to sponsor. [Toast via Stacker](https://keyt.com/stacker-business-economy/2026/09/26/survey-how-us-restaurants-are-handling-inflation-labor-ai-and-revenue-growth/) `[opened, vendor]`
- Popmenu: 44% use AI, 328 leaders. [Restaurant Technology News](https://restauranttechnologynews.com/2026/02/research-69-of-restaurants-are-adopting-ai-while-81-increase-digital-marketing-investment/) `[snippet, vendor]`

### Inferences
- Toast's ARR works out to about $13,200 per location, my calculation. It is an average that includes large accounts, so it only sizes what one POS vendor takes from a location.
- A review, SEO or scheduling tool as a lead feature collides with Toast directly for Toast shops. Clover is the largest gap and the largest base, about 175,000 locations with no first-party agent found.
- The 26% and 86% conflict mostly reflects "experimenting" and vendor features counted as AI. It does not show that owners run AI agents.

### Gaps
- SpotOn locations, legacy and cash register share at independents. [One aggregator](https://www.duck-hub.com/blog/restaurant-pos-market-statistics) lists these only as the unmeasured remainder `[snippet]`.
- Scheduling, accounting and reservation tool share at independents. I found no credible figure for any of them.
- Current Toast and Square prices for AI features. Blogs quote $34.99 to $89.99 per location for Toast plans; I did not verify them.
- Square's 2026 report numbers and JBF's tables are behind forms.

## 6. Who owns them, what language do they work in, and whom do they trust?

### Takeaway
More than a third of restaurant owners are foreign-born, about twice the share in other industries, and 22% of restaurant workers are. Language use at work is unmeasured. The Restaurant Association of Maryland reaches owners through workers' comp, food safety training and wage advocacy, and it already lists an AI marketing partner.

### Cited findings
- About 36% of restaurant owners are foreign-born against 19% elsewhere. [UC Berkeley and One Fair Wage via Davis Vanguard](https://davisvanguard.org/2025/10/deportation-impacts-restaurant-industry/) `[snippet; One Fair Wage is an advocacy group]` Other estimates: 34% ([Immigration Research Initiative](https://immresearch.org/amid-immigration-crackdowns-new-report-shows-role-of-business-owners-who-are-immigrants-women-people-of-color/), March 2026) and 36.8% of accommodation and food services ([SBA](https://advocacy.sba.gov/wp-content/uploads/2022/10/Small-Business-Facts_Immigrant-Business-Ownership_508c.pdf), 2018 to 2019) `[secondary, not reopened]`.
- All-industry baseline: immigrants own 19.1% of employer firms. [USAFacts](https://usafacts.org/articles/how-many-us-businesses-are-owned-by-immigrants/) `[snippet]`
- 22% of restaurant employees were born outside the US. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- NRN reports local shocks to independents: only 20% of Latino businesses in Minneapolis-St. Paul operated normally during an ICE deployment, per the Latino Economic Development Center, and closures in Washington, DC followed the federal shutdown. [NRN](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025) `[opened]`
- Restaurant Association of Maryland offers ServSafe, alcohol awareness and harassment training, ProStart and apprenticeships, and a workers' comp program it calls its most used for over 30 years. It runs a "Save the Tip Credit" campaign and lists Owner.com as AI marketing. The page mentions no language programs. [RAM](https://www.marylandrestaurants.com/) `[opened]`
- Peers are the top source of AI guidance at 45%, SBDCs 24%, for all small firms. [SBE Council](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf) `[secondary, not reopened]` Maryland SBDC and county channels also exist. [Maryland SBDC](https://www.marylandsbdc.org/), [Prince George's County EDC](https://www.pgcedc.com/latino-business-services) `[secondary, not reopened]`

### Inferences
- RAM's workers' comp channel and tip credit fight make it a real but political door. Partnering could read as taking a side on wages, and the association's listed AI partner, Owner.com, drew complaints in a small convenience sample of restaurant-vendor reviews. [Owner.com on Trustpilot](https://www.trustpilot.com/review/owner.com) `[secondary, not reopened]`
- A POS rep is likely a real trust channel, since reps show up in person, though I found no survey. The in-language rep model of the delivery app Fantuan is the best proxy. [CNBC via NBC Boston](https://www.nbcboston.com/news/business/money-report/under-the-radar-delivery-apps-are-gaining-ground-in-the-u-s-by-courting-asian-restaurants/3728453/?amp=1) `[secondary, not reopened]`

### Gaps
- Language spoken in kitchens, staff chats or with owners. No federal or trade measure found. Resume-based Zippia figures and undated op-eds are not usable.
- NRA's demographic profile of owners: the only link available failed to load, so I could not read the original.
- Trust ranking specific to restaurant owners, and RAM's member count or independent share.

## 7. Which compliance chores carry real money?

### Takeaway
Maryland's tip credit carries a per-pay-period statement duty and the federal back-wage tail is real, at about $60,000 to $200,000 in individual restaurant cases DOL publicized. Allergen duties are light today, since the 2026 disclosure bill shows no action after its hearing. Inspections cost little weekly and matter only at the tail.

### Cited findings
Maryland wages:
- $15.00 minimum. Tipped employees earning more than $30 a month in tips can be paid $3.63 cash if tips reach the minimum, and the employer covers any shortfall. Restaurants must issue a Tip Credit Wage Statement each pay period showing the effective hourly rate. [Maryland Department of Labor](https://www.dllr.state.md.us/labor/wages/wagehrfacts.shtml) `[opened]`
- Prince George's County $15.30 in 2026. Howard $16.00 by fiscal 2027. Montgomery $15.50, $16.00 or $17.65 by employer size as of July 2025, with $4.00 tipped pay. Federal tipped floor $2.13. [SB 886 fiscal note](https://mgaleg.maryland.gov/2026RS/fnotes/bil_0006/sb0886.pdf) `[opened]` Prince George's tipped rate stays at $3.63. [Bloomberg Government](https://news.bgov.com/payroll/maryland-announces-tipped-minimum-wage-for-prince-georges-county) `[snippet]`
- Current Maryland wage law exempts, among others, an employer's immediate family and employees of an on-premises food and drink establishment with annual gross income of $400,000 or less. [SB 886 fiscal note](https://mgaleg.maryland.gov/2026RS/fnotes/bil_0006/sb0886.pdf) `[opened]`
- HB 1229 / SB 886 would raise the minimum to $25 by 2030 and end the tip credit by 2031, contingent on a constitutional amendment. The fiscal note calls the small business effect meaningful. The bill page last showed a February hearing. A third-party tracker's status is ambiguous, so I found no evidence of enactment. [HB 1229](https://mgaleg.maryland.gov/mgawebsite/Legislation/Details/HB1229?ys=2026RS) `[opened]`, [BillTrack50](https://www.billtrack50.com/billdetail/1969355) `[snippet]`

Federal:
- The Fifth Circuit vacated DOL's 80/20/30 tip rule on Aug 23, 2024. [Littler](https://www.littler.com/news-analysis/asap/fifth-circuit-vacates-dols-802030-rule-tipped-employees) `[snippet]` Vendor guides still present 80/20 as a Maryland rule, and Maryland's labor page does not state one. [Lavu](https://lavu.com/restaurant-labor-laws-md-bar/) `[snippet]`. Do not repeat the claim without counsel.
- No Tax on Tips: 2026 W-2s need qualified tips in Box 12 code TP and an occupation code in Box 14b, per law firm summaries of IRS Notice 2025-69. One source gives different box numbers, so check the final instructions. [Miller Johnson](https://millerjohnson.com/publication/irs-issues-guidance-on-no-tax-on-qualified-tips-and-qualified-overtime-what-employers-should-know/) `[snippet]`
- WHD recovered more than $259M for nearly 177,000 workers in FY2025, $1,465 each, all industries. Reported restaurant cases: a Denver restaurant $61,568 for 11 workers, about $5,600 each by my calculation; an Aurora, Colorado Thai restaurant $107,300 for 27 workers; an Oregon restaurant $200,137 for overtime and tip pool violations. [DOL releases](https://www.dol.gov/newsroom/releases/whd/whd20251219) `[snippet; direct fetch returned 403, exact release per case unconfirmed]`, [KATU](https://www.katu.com/news/local/mcminnvilles-taste-of-india-to-pay-200k-after-overtime-and-tip-violations-oregon-wages-labor-department-wage-hourly-employee-rights-civil-money-penalty-minimum-overtime-ot) `[snippet]`
- Food service back wages were $31.7M in FY2021, older. [DOL](https://www.dol.gov/index.php/newsroom/releases/whd/whd20220630-1) `[snippet]`

Allergens and inspection:
- Maryland food establishments must display an allergy poster since 2013. Violations of that subtitle are misdemeanors, up to $1,000 first and $2,500 second offense, plus a civil penalty up to $5,000. Packaged food must carry allergen labels. [HB 181 fiscal note](https://mgaleg.maryland.gov/2026RS/fnotes/bil_0001/hb0181.pdf) `[opened]`
- HB 181 would require written disclosure of main allergens per menu item, on a menu, QR code or chart. Last action was a Feb 3, 2026 hearing, per the state page. HB 105 was withdrawn Feb 9. [HB 181](https://mgaleg.maryland.gov/mgawebsite/Legislation/Details/HB0181?ys=2026RS), [HB 105](https://legiscan.com/MD/text/HB105/2026) `[snippet]`
- High-priority facilities get inspected three times a year at 4-month intervals. Low-priority facilities at a minimum once every 2 years. [COMAR 10.15.03.30](https://www.law.cornell.edu/regulations/maryland/COMAR-10-15-03-30) `[snippet]` Prince George's closure means temporary license suspension for immediate hazards, uncorrected violations or no permit. [County dataset](https://opendatanetwork.herokuapp.com/dataset/data.princegeorgescountymd.gov/umjn-t2iz) `[snippet]`

### Inferences
- A menu-to-allergen chart is a cheap, explainable agent output, and code can check it against recipes, but no law requires it in Maryland today. Present it as a guest-safety aid, not as compliance.
- The tip statement is a recurring, rule-based duty that payroll software likely handles for shops on it. A cash-heavy shop running paper payroll carries the risk. No data shows who does which.
- The $400,000 exemption means a small on-premises shop's duties may differ under state law, while federal law may still apply. Any wage feature in software for these owners needs a lawyer's check before it says anything to an owner.

### Gaps
- Food service back wages for FY2025, available only by filtering the DOL enforcement database.
- Maryland conformity on the federal tip deduction, FAMLI start date and sick leave. I found nothing on any of them in these searches.
- Prince George's own inspection schedule, closure counts and cost of a closure. Enforcement odds for a small Maryland restaurant.

## 8. How do cafes and coffee shops differ from full-service and counter-service restaurants?

### Takeaway
A single advice set breaks on reservations, phone, delivery, tips and catering. Sourced segment data covers full service against limited service only, and coffee sits inside limited service, so coffee-specific claims rest on weak survey data and inference.

### Cited findings
- Off-premises is 89.9% of limited-service traffic against 35.4% of full service. Drive-thru is 33.9% against 0.7%. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- Limited-service operators are more likely to have delivery and to like it. Technology for reservations and inquiries matters to 43% of full service against 8% of limited service. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- Coffee margin claims conflict. A subscriber survey, the 2025 Independent Coffee Shop Industry Report, is quoted at 13.8% net by a secondary page, while other pages say 2.5 to 10% or 5 to 15%. A claim crediting 2 to 10% to the Specialty Coffee Association could not be confirmed. [Coffee Shop Keys](https://coffee-shop-keys.beehiiv.com/p/the-2025-independent-coffee-shop-industry-report-subscriber-discount-inside), [Bellwether](https://bellwethercoffee.com/blog/coffee-shop-profit-margins), [TimeTackle](https://www.timetackle.com/coffee-house-profit-margins/) `[snippet, weak]`
- Blogs put coffee cost of goods at 25 to 35% and labor at 25 to 35%. [TimeTackle](https://www.timetackle.com/coffee-house-profit-margins/) `[snippet, weak]`
- Indie coffee owners' cost pressures were surveyed by a vendor. [joe coffee](https://joe.coffee/blog/posts/survey-rising-costs-indie-coffee/) `[snippet, vendor; numbers not read]`

### Inferences
| Topic | Full service, including ethnic sit-down | Counter service, including carryout | Cafe or bubble tea |
|---|---|---|---|
| Phone | Reservations, events, hours; miss rate low, hold long | Orders at peak; miss rate highest in vendor data | Few calls at walk-in shops, inferred; not measured |
| No-shows | Real | None | None |
| Catering | Private events and party trays | Trays, office lunch; ezCater fit | Boxes and pastry; size not measured |
| Delivery | Fewer on apps, most critical of apps | Heavier and more positive | Drink quality in transit limits it, unmeasured |
| Food cost | Many SKUs, proteins, recipe drift | Fewer SKUs, supplier receipts | Few SKUs, high drink margin, pastry waste |
| Staff | Tip credit, tip pools, cooks hardest to hire | Mixed tips, family staff | Tips at counter; staff makeup not measured |
| Reviews | Heavily read | Read | Read, plus Instagram |

- Advice that breaks: "answer the phone" for cafes; "cut no-shows" for counter service; "review your commission tier" for shops off apps; "tip credit" for shops that do not use it; "catering" for any shop without kitchen slack.

### Gaps
- NAICS 722515 snack and coffee unit counts, revenue and Maryland numbers, blocked by the Census API key.
- Phone share or call volume for cafes. Separate restaurant data for ethnic or immigrant-owned formats. Any measurement of catering at cafes.

## 9. Is the owner's real constraint time, money or attention?

### Takeaway
Owners name money, and profit data backs them: 42% were not profitable and the median keeps 3 to 4 cents on the dollar. No survey directly compares time, money and attention. Inferred from behavior, money sets what an owner cares about and attention sets what they will adopt, so a tool must save money while asking for almost no attention.

### Cited findings
Money:
- Most significant 2026 challenges, full service and limited service: economy 27/25, labor costs 16/16, food costs 15/17, building sales 13/13, recruiting 9/9. More than 90% cite food, labor, insurance and inflation as significant. Over 80% cite card fees. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened]`
- JBF independents' top worries are rising costs, labor costs and finding staff. [JBF press via AI Journal](https://aijourn.com/?p=492892) `[snippet]`

Attention and tool load:
- Independents face a tool landscape the foundation describes as more tools and more decisions, too expensive to get wrong, with the best results at moderate adoption. [JBF](https://www.jamesbeard.org/impact/institute/restaurant-technology) `[opened]`
- 42% of operators experiment with AI only through vendors. [Toast via Stacker](https://keyt.com/stacker-business-economy/2026/09/26/survey-how-us-restaurants-are-handling-inflation-labor-ai-and-revenue-growth/) `[opened, vendor]`
- Lack of time was named by 27.1% as a barrier to understanding AI, most by the smallest firms. All small firms. [ICIC report](https://icic.org/wp-content/uploads/2025/02/ICIC_AI-In-Business_Report.pdf) `[secondary, not reopened]`

What they will and will not hand over:
- Trust is stated high at 81% for business needs, while 35% plan tech to reduce staff and guest touchpoints if labor worsens. [Toast via Stacker](https://keyt.com/stacker-business-economy/2026/09/26/survey-how-us-restaurants-are-handling-inflation-labor-ai-and-revenue-growth/) `[opened, vendor]`
- Nearly two-thirds of operators say technology raises hospitality; only 41% of consumers agree. 46% of adults say they would likely use an AI chatbot to order and 39% an AI persona on a screen, with older adults much lower. [NRA SOI 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf) `[opened; chart labels are broken in the text layer]`
- More than a quarter of diners want no automation at all. Square 2025. [Square](https://squareup.com/us/en/the-bottom-line/selling-anywhere/future-of-restaurants) `[snippet, vendor]`
- Callers hang up on voice AI, and customers have pushed back on AI phones and promotions. [Square Community](https://community.squareup.com/t5/Feedback-Discussions/Voice-AI-Ordering-Initial-Setup-and-Feedback/m-p/823312), [PMQ](https://www.pmq.com/anthonys-ai-phone-system/), [Washingtonian](https://washingtonian.com/2026/06/26/this-bagel-shop-used-chatgpt-for-a-fathers-day-promotion-then-it-got-roasted-online/) `[secondary, not reopened]` 54% of AI site builders want to approve every change. [Bluehost](https://www.bluehost.com/blog/?p=280128) `[secondary, not reopened]`

### Inferences
- The owner keeps what touches a regular, a price, a schedule or a dollar out the door. Software can draft, flag and calculate. This fits a design where code ranks and the model explains, and the owner can approve, edit or skip each drafted task.
- Time is real but owners do not value a tool for it alone, since they rarely bill their own hours. Frame drafted tasks in dollars and ask seconds of the owner.
- The chore ranking inputs below are my judgment, not findings.

| Chore | Dollar weight | Measured time | Incumbent AI | Ease as a one-tap approval |
|---|---|---|---|---|
| Supplier receipt, price rise | High | None | Square Order Guide; R365 and MarginEdge at larger firms | High from a photo; Restaurant Depot and cash shops have no feed |
| Catering or event inquiry | Medium, lumpy | None | Hostie, Sadie, marketplaces | High when text arrives; low when it is a call to the owner |
| Review replies | Low direct | None | Toast IQ Grow, Meta, Square | Very high; crowded |
| Delivery disputes | Low | About 10 hours a month, vendor | Otter and others | Medium; needs app logins |
| Shift gaps and schedule | Medium | 3.7 hours a week, vendor | Toast Scheduling Agent, 7shifts | Medium; lives in group chats and tacit knowledge |
| Missed calls | Unknown | None | Many AI phone vendors, Square | Low; telephony and caller dislike |
| Menu and price updates | Medium with food cost | None | POS tools | Medium; writes to the POS are a risk |
| Tip and wage compliance | Tail risk | None | Payroll vendors | Low; legal risk from a wrong answer |
| Allergen chart | Low now | None | None found | High; recipes are the blocker |

### Gaps
- No survey I found asks owners to rank time, money and attention, and none records what owners refuse to automate. Three owner conversations would add more than further searching.
- The Reddit owner voice is missing, as noted in section 2.

## Sources

Maple's blog carried promotional text aimed at AI assistants, so read Maple's figures as marketing.
