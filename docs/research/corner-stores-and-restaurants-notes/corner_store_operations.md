# Corner store operations

Checked Nov 6, 2026. Tags: [opened] means I read the page or its PDF text. [snippet] means I saw the number only in search results, so open it before relying on it. [ran] means I queried a public data service myself. [secondary, not reopened] means the fact comes from an earlier research summary and I did not reopen the linked source for this note. [secondary, source not reopened] means the same, with no original source URL found. USDA FNS pages (fns.usda.gov, fna.usda.gov) and Toast's site returned 403, so USDA data comes from a mirror, from its data layer, or from secondary sources. The research session's web search budget ran out before the last search, so a few threads below stop at the search stage and say so. Local detail covers Maryland, DC and Baltimore.

Main caution: almost every public "convenience store" number is a chain-weighted average of fuel stores. A NACS average store has about 20 employees. A corner store in the one Baltimore study has under 1 paid non-family worker and about 2 family workers.

## How many stores are there, and how many are independent?

### Takeaway
NACS counts 151,975 US stores, 63% owned by operators with 10 or fewer stores, but 81% of the count sells fuel, so the bodega without pumps is at most about 29,000 of that number. Bodegas also scatter across NAICS codes, so no single official count exists.

### Cited findings
- US total 151,975 stores as of Dec 31, 2025, down 280 (0.2%). Operators with 10 or fewer stores own 95,672 (63%). Operators with 500-plus own 33,810 (22.2%). [NACS, Jan 2026](https://www.convenience.org/stay-current/news/2026/january/26/2026-sees-slight-decrease-c-store-count_research) [opened]
- Stores selling fuel: 122,620, or 80.7%. [NACS fact sheet](https://www.convenience.org/Research/Convenience-Store-Fast-Facts-and-Stats/FactSheets/IndustryStoreCount) [opened]
- Conflict on the single-store share. The same NACS fact sheet also labels 63% as single-store operators, which matches its 10-or-fewer band, so the label looks loose. A vendor blog credits NACS with more than 60% single-store, with no link. [NACS fact sheet](https://www.convenience.org/Research/Convenience-Store-Fast-Facts-and-Stats/FactSheets/IndustryStoreCount) [opened]; [Petrosoft, Aug 2026, vendor](https://petrosoftinc.com/blog/a-big-difference-for-one-store-owners/) [opened]
- State counts published by NACS stop at the top 10. New York has 7,561. Maryland and DC are not shown. [NACS, Jan 2026](https://www.convenience.org/stay-current/news/2026/january/26/2026-sees-slight-decrease-c-store-count_research) [opened]
- BLS QCEW 2024 annual averages, private establishments with employees [ran]:

| Area | [445131 convenience retailers](https://data.bls.gov/cew/data/api/2024/a/industry/445131.csv) | [457110 gas stations with convenience](https://data.bls.gov/cew/data/api/2024/a/industry/457110.csv) | [445110 supermarkets and other grocery](https://data.bls.gov/cew/data/api/2024/a/industry/445110.csv) |
|---|---|---|---|
| US | 35,127 (165,369 workers, $569 average weekly wage) | 101,351 (883,550 workers) | 58,659 |
| Maryland | 1,068 (7,389 workers, $588) | 1,021 (9,556 workers) | 1,179 |
| DC | 160 | 78 | 161 |
| Baltimore City | 188 | 86 | 167 |
| Baltimore County | 143 | 141 | 158 |
| Prince George's County | 215 | 154 | 198 |
| Montgomery County | 115 | 120 | 200 |
| New York State | 3,812 | 3,624 | 6,816 |
| NYC five boroughs (sum) | 1,959 | 442 | 4,203 |

- SNAP-authorized retailers by FNS store type, from the public `snap_retailer_location_data` layer, last edited Nov 5, 2026 [ran]. The layer's name and fields match the FNS retailer locator, but I could not open the FNS page that links to it. [Layer](https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0)

| Area | Convenience Store | Grocery Store | Supermarket | Super Store |
|---|---|---|---|---|
| US | 108,293 | 21,042 | 19,654 | 20,773 |
| Maryland | 1,556 | 355 | 364 | 393 |
| DC | 184 | 29 | 38 | 33 |
| Baltimore City | 363 | 62 | 22 | 28 |
| Baltimore County | 209 | 42 | 56 | 60 |
| Prince George's County | 244 | 59 | 43 | 75 |
| Montgomery County | 84 | 56 | 52 | 74 |
| New York State | 6,480 | 2,658 | 1,239 | 1,361 |

- USDA's own count of SNAP convenience stores was 119,688 as of June 2025, and NACS says more than 118,000. The live layer shows 108,293. [USDA impact analysis](https://content.govdelivery.com/attachments/WIGOV/2026/08/03/file_attachments/3734770/FNS-2025-0018-0002_content%20%282%29.pdf) [opened]; [NACS SNAP page](https://www.convenience.org/Advocacy/Issues/SNAP/SNAP-Stocking-Requirements) [opened]
- DC Central Kitchen's Healthy Corners program runs in more than 50 DC corner stores, with about 450,000 units of food a year (Sep 2026). [DCCK](https://dccentralkitchen.org/2026/09/01/dc-central-kitchen-celebrates-15-years-of-healthy-corners/) [snippet]

### Inferences
- Stores with no fuel in the NACS count: 151,975 minus 122,620 is 29,355 (19%). Treat that as the ceiling for the NACS view of a pump-free corner store.
- QCEW 445131 plus 457110 gives 136,478 nationally and 7,436 in New York, close to NACS's 151,975 and 7,561. So NACS roughly tracks employer stores in those two codes.
- In NYC, 4,203 grocery-coded establishments sit against 1,959 convenience-coded ones. Many bodegas are probably coded 445110, so counting only 445131 undercounts them. 445110 also holds real supermarkets, so it cannot be added in whole.
- QCEW leaves out stores with no employees, which matters for family-run shops.
- Working number: about 2,100 employer convenience and gas-convenience stores in Maryland, and about 1,550 SNAP convenience stores, of which 363 are in Baltimore City. DC adds 238 employer stores and 184 SNAP convenience stores.
- The drop from 119,688 to 108,293 SNAP convenience stores could reflect exits, recoding or a different scope. I cannot tell which, so do not present it as stores leaving SNAP.

### Gaps
- True single-store count: not published openly. The full TDLinx table or the $1,199 [NACS report](https://www.convenience.org/power-your-business/store/nacs-state-of-the-industry-report-of-2025-data) may hold it.
- County Business Patterns and Economic Census values: the Census API now requires a key and returned a redirect, so I did not get them. This also blocks single-unit firm counts and sales per establishment.
- NYC bodega totals of 10,000 to 13,000 appear in press and advocate estimates. I could not trace them to a count.

## Revenue, margin, category mix, shrink and card fees

### Takeaway
Public benchmarks describe a $250,000-a-month inside-sales fuel store with 20 staff, which is not a bodega. I found no public revenue or margin figure for an independent non-fuel corner store, and the only store-level evidence is single-owner testimony.

### Cited findings
**Chain-weighted national averages (NACS, 2025 data unless noted; sample represents more than 35,000 stores)**
- Inside sales $341.2B, up 1.7%. Foodservice 28.5% of in-store sales and 38.9% of in-store gross profit. Packaged beverages 18.7%. Fuel 65.0% of sales and 38.8% of gross profit. [NACS, Apr 2026](https://www.convenience.org/stay-current/news/2026/april/15/u-s-convenience-in-store-sales-top-$340-billion) [opened]
- Card fees a record $21.3B. 45,160 transactions per store per month, down 2.7%. 19.9 employees per store and $15.04 average hourly wage. [NACS, Apr 2026](https://www.convenience.org/stay-current/news/2026/april/15/u-s-convenience-in-store-sales-top-$340-billion) [opened]; [C-Store Dive](https://www.cstoredive.com/news/3-big-numbers-nacs-c-store-industry-highlights/817733/) [opened]
- Direct store operating expense $94,179 per store per month nationally. Northeast inside sales $429,284 per store per month, 70.9% above the national average. National inside operating profit per transaction was minus 7 cents. [NACS Magazine, Jun 2026](https://www.nacsmagazine.com/issues/june-2026/regional-reports) [opened]
- Costs in 2025: wages and benefits up 4.2%, workers' comp up 9.8%, health benefits up 10.5%. [NACS, 2026](https://convenience.org/stay-current/conveniencecorner/state-of-the-c-store-industry-profit-under-pressure) [opened]
- Cigarettes in 2024: $46,437 sales and $6,389 gross profit per store per month, 19.4% of in-store sales, 7.1% of in-store gross profit, margin about 13%. Other tobacco: $19,663 sales and $5,801 gross profit, 6.3% of in-store gross profit, margin near 30%. [NACS Magazine, Dec 2025](https://www.nacsmagazine.com/Issues/December-2025/Are-Cigarettes-Losing-Their-Grip) [opened]
- A different NACS dataset gives cigarettes 18.8% of inside sales in 2024, down from 30.9% in 2015. NIQ data gives 24.2%. Denominators differ. [NACS, Mar 2026](https://www.convenience.org/stay-current/news/2026/march/9/3-decade-tobacco-nicotine-data_research) [snippet]; [NACS Magazine, Apr 2025](https://www.nacsmagazine.com/Issues/April-2025/The-Increased-Importance-of-OTP-Sales-in-C-Stores) [snippet]

**Closer to an independent**
- Baltimore corner stores, n=24, low-income tracts, published 2015 so older than the cutoff: 165 customers on an average day (SD 145), 0.75 non-family paid employees, 1.96 family workers, 9.5 years running the current store, 15.6 years in food retail, 91.7% accept SNAP, 45.8% accept WIC. [Mui et al. 2015](https://www.mdpi.com/1660-4601/12/12/14965) [opened]
- QCEW implies 4.7 workers per convenience-coded establishment, against 8.7 per gas-convenience one. [BLS QCEW 2024](https://data.bls.gov/cew/data/api/2024/a/industry/445131.csv) [ran]
- One owner, Manhattan, 2020: she says about 80% of a typical store's revenue is cigarettes and lottery. Margins she gives: cigarettes 10 to 20%, lottery about 5%, e-cigarettes about 15%, everything else 20 to 30%. Her fixed costs were about $21,000 a month at East Village rent. This is one person's account, and her own tobacco and lottery licenses were suspended at takeover. [MEL Magazine, Mar 2020](https://melmagazine.com/en-us/story/the-quick-and-ubiquitous-economics-of-bodegas) [opened]

**Lottery (Maryland)**
- FY2025: $195.7M in sales and cashing commissions and about 4,275 to 4,300 retailers. The state gives an average of $45,000 per retailer. [MD budget testimony, FY2027](https://dbm.maryland.gov/budget/FY2027Testimony/E75D.pdf) [opened]; [MD Managing for Results, FY2027](https://dbm.maryland.gov/Documents/MFR_documents/2027/Maryland-Lottery-and-Gaming-Control-Agency-MFR.pdf) [opened]
- Commission cut on June 1, 2024: sales from 6.0% to 5.75%, cashing from 3.0% to 2.0%. Total commissions fell from $220.2M in FY2024 to $195.7M in FY2025. [MD Managing for Results, FY2027](https://dbm.maryland.gov/Documents/MFR_documents/2027/Maryland-Lottery-and-Gaming-Control-Agency-MFR.pdf) [opened]
- Retailers include Walmart, Royal Farms and Giant. [MD budget testimony, FY2027](https://dbm.maryland.gov/budget/FY2027Testimony/E75D.pdf) [opened]

**EBT share**
- Convenience stores are about 45% of SNAP retailers but redeem about 5% of benefits: about 41% and 5% in FY2015, about 45% and 5.5% of $55.6B in FY2019. All older than the 2023 cutoff. [CRS](https://www.everycrsreport.com/reports/R44650.html) [snippet]; [CBPP](https://cbpp.org/snap-retailers-database) [snippet]
- One East Flatbush deli says about half its customers pay with EBT (Oct 2025). One store's estimate. [News 12 Brooklyn](https://brooklyn.news12.com/2025/10/31/brooklyn-bodegas-worry-about-impact-of-freeze-on-snap-benefits/1HVq8PlL88PzR8u1ktgzEX) [opened]

### Inferences
- NACS average inside sales: $429,284 divided by 1.709 is about $251,000 per store per month. NACS does not print this in the pages I read.
- Cigarette figures imply about $239,000 in-store sales and $90,000 in-store gross profit per month in 2024, about a 38% in-store margin. Foodservice lifts that, so a store with no kitchen would sit lower.
- Card fees average about $140,000 per store per year, or about $11,700 a month. That includes fuel and chains, so do not quote it for a bodega. For a bodega, use the owner's own card volume: each 0.1 point on $10,000 of monthly volume is $10 a month.
- FY2019 SNAP arithmetic gives very roughly $27,000 per convenience store per year (5.5% of $55.6B over about 112,000 stores). The mean hides huge spread: a low-income corner store can depend on EBT, and a highway store may barely use it.
- Chore value rule of thumb: an hour a week is $780 a year at NACS's $15.04 wage and $2,600 at USDA's $50 loaded manager rate. Family labor is unpaid, so most time savings are not cash savings. Risk avoidance has a clearer dollar value than time saved.

### Gaps
- Revenue, gross margin, net margin and category mix for independent or non-fuel stores: not found. NACS may split by operator size in the paid report.
- Shrink: the only size split I saw is a vendor blog crediting NACS 2020 data (1.6% average, $2,868 per year per store for 1 to 10 store operators, $14,208 for 201 to 500). The page returned 404 when opened, so it stays unverified. [Petrosoft](https://petrosoftinc.com/blog/new-2021-c-store-gas-station-industry-soi-stats-from-nacs/) [snippet]
- Independent card rates: not researched to a reliable number. NFIB says swipe fees more than doubled since 2012, which is advocacy. [NFIB, Feb 2025](https://www.nfib.com/news/press-release/small-business-restaurants-retail-hospitality-and-others-in-major-push-for-credit-card-swipe-fee-changes/) [snippet]
- Current EBT share by store type: the FY2024 FNS dashboard returned 403.

## What the owner does each week, and which chores take the most time

### Takeaway
I found no US time-use study of independent owners. The best local evidence, from Baltimore, says the owner's day is shaped by supply runs, with little staff and near-constant counter duty. Hours on invoices and price changes come only from vendor blogs.

### Cited findings
**Buying and supply**
- Baltimore owners stock through a mix of self-supply and delivery. 24 stores named 42 suppliers. Wholesale clubs sit at the center of both supply networks, including B. Green, BJ's and Costco. Average distance to suppliers was 34 km. [Mui et al. 2015](https://www.mdpi.com/1660-4601/12/12/14965) [opened]
- In 20 Baltimore interviews (2012 to 2013), owners generally used the nearest wholesaler to keep daily shopping efficient, even when cheaper options existed. They set prices from wholesaler prices and often followed wholesaler sale items. They named limited time, storage and staff as constraints. [Baltimore owner interviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC5702771) [opened]
- Convenience stores get deliveries 1 to 2 times a week and average about 3,600 square feet. [NACS SNAP page](https://www.convenience.org/Advocacy/Issues/SNAP/SNAP-Stocking-Requirements) [opened]
- Owners also use many distributors and sometimes buy at other stores and mark up. [MEL Magazine, 2020](https://melmagazine.com/en-us/story/the-quick-and-ubiquitous-economics-of-bodegas) [opened]

**Prices, inventory, invoices (vendor-only numbers)**
- Toast's 2026 survey of 340 convenience, grocery and bottle-shop operators with 16 or fewer locations names inventory management the top pain point, up 6 points. Simplifying operations is a top-three goal for 31%, up 12 points. Combined sample, no percentage for inventory in the copy I read, vendor data. [Toast via 01net](https://www.01net.it/the-2026-voice-of-the-retail-industry-survey-how-u-s-retailers-are-feeling-about-inflation-expansion-ai-and-more/) [opened]
- A vendor says entering vendor price changes by hand can take hours and adds errors, that gas station owners can get dozens of paper delivery invoices a week, and that manual counts in busy periods cause over-ordering and stockouts. No measurement behind any of it. [Petrosoft, Aug 2026, vendor](https://petrosoftinc.com/blog/a-big-difference-for-one-store-owners/) [opened]
- Another vendor blog says about 90 supplier invoices a month and about 3 minutes each, which is its own illustration. [Most Edge, vendor](https://most-edge-site.vercel.app/blog/convenience-store-invoice-management-multi-store) [snippet]

**Shelf and vendor control**
- A 318-store field study found near-identical inventory, shelf layout and signage across independents, dictated by manufacturers, while checkout and pricing varied widely. [CSI Works 2025, vendor](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf) [opened]
- A 2016 first-hand account from two days in a Nashville store says vendors were effectively controlling the store, lottery buyers tie up the single register, and lottery accounting and compliance are cumbersome for thin margin. [Critelli, 2016, older](https://mikecritelli.com/who-stocks-the-beverage-cooler) [opened]

**Hours (UK only)**
- Nearly a quarter of UK independent owners worked more than 70 hours a week (ACS, 2018). About half had no day off in a year. Not US data. [Convenience Store UK](https://conveniencestore.co.uk/your-business/one-in-four-c-store-owners-work-70-plus-hours-a-week-says-acs/571409.article) [snippet]; [The Grocer](https://www.thegrocer.co.uk/convenience/half-of-independent-c-store-owners-have-not-had-a-single-day-off-in-a-year-research-finds/659571.article) [snippet]

### Inferences
Ranking of chores for automation, mine, based on the evidence above and the compliance section. Dollar figures use NACS averages, so scale them down for a smaller store.

| Chore | Evidence of pain | Dollar stake | Needs POS data? | Fit for a one-tap drafted task the owner approves |
|---|---|---|---|---|
| SNAP stocking check: shelf photo to variety gap and shopping list | USDA: 73% of convenience stores were short; deadline Nov 4, 2026 | SNAP authorization. USDA's cost: 4 hours or $200 to learn it, $17 to $18 a year to stock | No | High. Rare, rule-based, fear-driven |
| Tobacco and vape: is this SKU legal, renewal dates, ID-check reminders | Fines plus Maryland suspension up to 90 days on a second violation | About $36,600 gross profit for a 90-day loss at NACS 2024 averages ($12,190 a month). Up to $20,678 per FDA action | No | High. Calendar and lookup work |
| License and renewal calendar, across tobacco, lottery, alcohol, health, SNAP, WIC | Many agencies, annual cycles; no data on missed renewals | Loss of the top categories. Lottery alone averages about $3,750 a month (Maryland mean, skewed by chains) | No | High, low build cost, low daily value |
| Invoice check against delivery and last price | Vendor claims only | Unknown. No source measures errors | No, works from a photo | Medium to high if error rates are real. Test with an owner |
| Price change sync from wholesaler cost | Owners price from wholesaler cost; vendor claims hours | Unknown | Yes for full value, a printed list otherwise | Medium |
| What to buy on the next wholesaler run | Daily trips, 42 suppliers across 24 stores | Unknown | Partly. Many stores have no item data | Medium, weak without sales data |
| Staff scheduling and payroll | About 1 paid non-family worker in Baltimore sample | Small at this size | No | Low |
| Review and lead follow-up | Walk-in trade, 165 customers a day in Baltimore | Unknown, likely small | No | Low. See "Can customers reach them digitally?" |

### Gaps
- Hours per chore for US independents: no source. The "15 hours a week" figure credited to NRF appears only in vendor posts, so do not use it. Admin-hour stats for small businesses in general show the same pattern, tracing back to aggregator pages with no primary report found. [secondary, source not reopened]
- Cash reconciliation, lottery settlement cadence and shelf-reset labor: found no owner-voice or official source.
- Reddit and forum owner threads: targeted searches returned no usable US owner threads, and mirrored Reddit pages looked unreliable. An owner interview would beat anything found here.

## What software do they use, and is a data layer possible?

### Takeaway
Software for these stores should assume no POS. The one field count finds 42% of independents on old cash registers and the one federal study finds 42% of small SNAP retailers with no scanning. NRS is the only independent-focused POS with a verifiable base, at 35,400 locations.

### Cited findings
- CSI Works field count, Jan 31 to Feb 5, 2025, 318 independents in CA, AZ, TX, LA, MS, AL and FL, mixing liquor, convenience, smoke, grocery and butcher shops: old cash register 42.1%, non-integrated hardware 27.7%, integrated POS 27.0%, software-only 3.1%. By name: NRS 13.8%, HP 8.8%, Clover 6.9%, general computer 6.3%, ELO 3.8%, Verifone 2.5%, iPad 2.5%, Square 1.9%, Lightspeed 1.3%. Vendor-authored for sales agents, no store-type split, and stores were found through Google. [CSI Works 2025](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf) [opened]
- The same study blames inertia over cost. Most owners it asked about old systems replied, "It works, so why change?" Independents inside branded gas stations often kept inherited Verifone systems. [CSI Works 2025](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf) [opened]
- USDA scanner assessment of small SNAP retailers: 63% lack equipment to identify SNAP-eligible items, 42% lack any scanning system, 21% have one that cannot identify SNAP items. Adding it would cost about $7,000 to $10,500 per retailer. 59% of non-adopters said they would adopt to keep SNAP. Franchise convenience stores were most ready and specialty stores least. The page has no study date (updated Jan 2025), so treat it as older. [USDA FNS](https://fns-prod.azureedge.us/node/10945) [opened]
- NRS at July 31, 2026: 40,400 active POS terminals, 35,400 retailer locations, 29,400 payment accounts. In Nov 2022 it reported more than 20,000 terminals at over 17,000 stores. NRS sells POS, payments, EBT and eWIC, e-commerce, payroll and cash advances. [IDT 10-K FY2026](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm) [snippet, SEC returned 503 on open]; [Supply Chain Dive, 2022](https://supplychaindive.com/news/uber-partnership-national-retail-solutions-same-day-delivery/637678) [opened]; [NRS and Krasdale, 2026](https://perishablenews.com/retailfoodservice/national-retail-solutions-nrs-and-krasdale-foods-form-strategic-partnership-to-empower-bodegas/) [opened]
- A Phoenix NRS merchant complained about lack of customization, and CSI says NRS restricts third-party software. CSI competes in this market, so read that with care. [CSI Works 2025](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf) [opened]
- OnPoint and Skupos target independents with scan data services. [C-Store Decisions, 2022](https://cstoredecisions.com/2022/04/07/nrs-partners-with-onpoint/) [snippet]

### Inferences
- NRS's 35,400 locations equal about 23% of NACS's total and 37% of its 10-or-fewer stores. NRS includes liquor and specialty shops, and some are in Canada, so the true convenience share is lower.
- Three tiers to design for. About 40% have no item data at all, about 30% have a scanner of some kind but scattered software, and about 30% have an integrated POS. Those shares are rough and come from one vendor sample of seven states without Maryland.
- The CSI method finds stores through Google, so it probably misses the least digital shops, and the cash register share may be understated.
- A product that needs a POS integration fails for most stores, and each integration covers few stores. Inputs must be phone photos of shelves and invoices, a wholesaler's price list, and the owner's voice.
- The two 42% figures use different definitions and years, so their match is partly coincidence. Report them side by side, not as confirmation.

### Gaps
- Share of the catalog that is unscanned or rung as open department keys: no source found. This matters for any tool built on POS item data, and it is unanswered.
- Market share for Modisoft, PDI, Gilbarco and Verifone among independents: not found. Modisoft, PDI and Gilbarco do not appear in the CSI list, and PDI and Gilbarco skew to fuel and chains by reputation, which I did not verify.
- Whether any Maryland-specific POS data exists: none found.

## Compliance chores that cost real money if missed

### Takeaway
The SNAP stocking rule is the sharpest current chore: the compliance date, Nov 4, 2026, passed two days before this check, and USDA's own analysis estimated 73% of convenience stores were short on varieties. Maryland tobacco rules add a suspension risk on top.

### Cited findings
**SNAP stocking**
- Final rule published May 8, 2026 (91 Fed. Reg. 25082), effective July 7, compliance by Nov 4, 2026. Seven varieties in each of four staple categories, up from three. One perishable variety in each of three categories, up from two. Snack bars, jerky, dips and spreads, spices, oils and broth no longer count as staples. [Hogan Lovells](https://www.hlc.com/en/publications/usda-issues-final-rule-amending-snap-retailer-stocking-standards) [opened]
- USDA's impact analysis, written for the proposed version: 87,648 of 119,688 convenience stores (73%) and 6,537 of 8,489 small groceries (77%) lacked the varieties, against 8% of combination stores. About 0.5% of small firms lacked perishables. Stores short on varieties need about 5 more, and dairy (48% short) and protein (37%) are the common gaps. Estimated cost is $200 once (4 hours at $50) plus $17 to $18 a year. About 2,000 stores lose authorization annually now, and USDA budgets for 5,000 extra denials and reapplications. [USDA impact analysis](https://content.govdelivery.com/attachments/WIGOV/2026/08/03/file_attachments/3734770/FNS-2025-0018-0002_content%20%282%29.pdf) [opened]
- Eligibility store visits are unannounced: an FNS contractor takes photos and inventory counts. [USDA impact analysis](https://content.govdelivery.com/attachments/WIGOV/2026/08/03/file_attachments/3734770/FNS-2025-0018-0002_content%20%282%29.pdf) [opened]
- NACS says stores must evaluate nearly every product on their shelves against a three-tier variety structure and that the six-month window is short. Advocacy, and in tension with USDA's 4 hours. [NACS, May 2026](https://www.convenience.org/stay-current/news/2026/may/8/usda-releases-complex-overhaul-of-snap-stocking-requirements) [opened]
- Trade press says bodegas in cities including Baltimore may lack the scale to stock the variety, and that SNAP often decides whether such stores stay viable. No numbers. [Food Trade News, Mar 2026](https://foodtradenews.com/2026/03/13/snap-stocking-standards-could-reshape-requirements-for-northeast-grocers/) [opened]

**SNAP restriction waivers**
- 23 states listed as approved, with neither Maryland nor DC among them. Virginia is on the list for sweetened beverages. On June 22, 2026, a federal judge blocked the waivers in Colorado, Iowa, Nebraska, Tennessee and West Virginia. This comes from Wikipedia, updated June 2026, because the USDA tracker returned 403. Sources disagree on Virginia's start date (Oct 1, 2026 here, April 1 elsewhere). [Wikipedia](https://en.wikipedia.org/wiki/SNAP_food_restriction_waivers) [opened]; [Civil Eats, Mar 2026](https://civileats.com/2026/03/04/usda-approves-more-snap-waivers-limiting-soda-and-candy/) [snippet]

**Tobacco and vape, federal**
- FDA sought the then-maximum $19,192 per violation against 22 retailers in Sept 2023, and $20,678 in early 2024, for selling unauthorized e-cigarettes. As of Feb 2024, FDA had sent more than 440 warning letters and filed 100 penalty actions on unauthorized products. [FDA via PR Newswire, 2023](https://prnewswire.com/news-releases/fda-seeks-fines-against-22-retailers-for-selling-illegal-youth-appealing-e-cigarettes-301942037.html) [opened]; [FDA, 2024](https://www.fda.gov/tobacco-products/ctp-newsroom/fda-seeks-20k-fines-against-retailers-selling-unauthorized-youth-appealing-e-cigarettes) [snippet]
- For sales to minors, FDA's Aug 2023 guidance shows maximums from $250 for a second violation in 12 months to $10,000 for a sixth in 48 months, usually after a first warning letter. No-tobacco-sale orders can follow five or more repeat violations in 36 months. [FDA guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/civil-money-penalties-and-no-tobacco-sale-orders-tobacco-retailers-revised) [snippet for amounts, page opened without them]

**Maryland**
- Tobacco Retail Modernization Act of 2024: license fee for cigarette and vape retailers up from $25 to $300. First-offense fine up from $300 to $500. Second violation can bring a suspension of up to 90 days, later ones up to 180 days, then revocation. Clerk or retailer can be cited. ID check for buyers under 30. Tobacco kept behind the counter. At least one state inspection per retailer per year. [Maryland ATCC, updated Feb 2025](https://atcc.prod.maryland.gov/laws-regulations/law-and-policy-updates/tobacco-retail-modernization-act) [opened]
- SB 249 (Ch. 415, 2026), effective Oct 1, 2026, changes vape license rules, including no extra fee for holders of certain tobacco licenses. [Maryland General Assembly](https://mgaleg.maryland.gov/2026RS/Chapters_noln/CH_415_sb0249t.pdf) [snippet]

### Inferences
- The stocking rule fits an approve-first drafted task better than anything else here: a shelf photo, a count against a published rule, then "buy oat milk and canned tuna on your next BJ's run," with an Approve or Edit tap. Code would apply the rule, and an AI model would only read the photo, so the pass or fail result comes from code and not from the model.
- USDA's 4-hour estimate and NACS's nearly-every-product claim bracket the real effort. A tool or estimate should say which it assumes.
- USDA's figures are from the proposed rule, and NACS says the final rule dropped several provisions it opposed, so the share may have moved. Say "USDA estimated before the final rule."
- Any tool that checks a store against this rule must say it is not a USDA determination. A wrong "you pass" could cost a store its authorization, so each result should carry a source link and a checked date.

### Gaps
- Final rule's impact analysis: not located. federalregister.gov blocked automated access and FNS returned 403.
- Enforcement on or after Nov 4, 2026, and whether checks happen only at reauthorization: not found.
- Current inflation-adjusted FDA maximums for 2025 or 2026: not found. FDA compliance-check failure rates for small retailers: not found.
- Not researched to a reliable answer, for lack of budget: Maryland alcohol licensing and Baltimore's liquor board, Maryland sales tax filing, Maryland WIC vendor rules, Baltimore health department license fees.

## Who owns these stores, and how do they learn about new tools?

### Takeaway
Ownership is heavily immigrant and splits by community within cities, with Korean American owners historically dominant in Baltimore. New tools reach owners through wholesalers, ISO sales agents and ethnic trade groups, and no survey measures how they decide.

### Cited findings
- Immigrants were 53% of grocery store owners, 61% of gas station owners and 43% of liquor store owners, from 2013 data, published 2015. Older than the cutoff. [AS/COA and FPI](https://as-coa.org/articles/immigrants-fundamental-main-street-business-study-shows) [snippet]
- Baltimore, older: authors estimate 75% of small food stores in Baltimore City were Korean American owned, which is their own estimate. 1,000 to 2,000 Korean merchants per a 2004 civil rights report, and about 750 KAGRO members. Published 2009. [Gittelsohn et al. 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC3043106) [opened]
- Baltimore, newer: 79% Asian or Hispanic, 21% African American owners across 24 stores (2015). Of 15 stores in 2012 to 2013 interviews, 7 were Korean American, 4 African American, 4 Indian, Chinese or Hispanic. [Mui et al. 2015](https://www.mdpi.com/1660-4601/12/12/14965) [opened]; [Baltimore owner interviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC5702771) [opened]
- Many Korean American merchants in Baltimore have retired and sold, per a Dec 2022 profile. No count given. [Baltimore Banner](https://www.thebanner.com/community/local-news/lees-mini-market-west-baltimore-WYBL6RZYM5GY5LSQFG2VH5R6IE) [snippet]
- New York: about 6,000 bodegas Yemeni-owned, per a 2017 account. YAMA, founded 2017, had 900 members boycotting a paper in 2019, and the same article cites 5,000 members, which conflict. Dominican and Puerto Rican owners preceded them. [Cornell ILR library](https://catherwood.library.cornell.edu/?p=40970) [snippet]; [Patch, 2019](https://patch.com/new-york/midtown-nyc/yemeni-bodega-owners-form-coalition-boycott-ny-post) [snippet]; [Smithsonian](https://www.smithsonianmag.com/smithsonian-institution/at-the-bodega-customers-can-get-pork-rinds-plantains-and-just-about-anything-they-need-heres-how-these-stores-became-a-community-anchor-of-latino-life-180989689/) [snippet]
- Language in practice: Baltimore researchers ran interviews and education in Korean, and 7 of 20 interviews in 2012 to 2013 were in Korean. Language barriers were among the reasons owners resisted changing ordering routines. [Gittelsohn et al. 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC3043106) [opened]; [Baltimore owner interviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC5702771) [opened]
- Entry worked through a trade group: the Baltimore KAGRO chapter wrote a support letter, then researchers met owners, and 13 corner stores joined. [Gittelsohn et al. 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC3043106) [opened]
- KAGRO of Maryland (Korean-American Grocers and Licensed Beverage Association) exists and was founded in 1995. [Baltimore Magazine, 2013](https://www.baltimoremagazine.com/2013/9/1/corner-life) [snippet]
- Distributor-led software: NRS partnered with Krasdale, which supplies over 3,500 independents, in 2026. It holds merchant events through Krasdale (250-plus attendees, July 2026), and earlier partnered with Jetro and Pitco. [NRS and Krasdale, 2026](https://perishablenews.com/retailfoodservice/national-retail-solutions-nrs-and-krasdale-foods-form-strategic-partnership-to-empower-bodegas/) [opened]; [C-Store Dive press release](https://www.cstoredive.com/press-release/20260804-nrs-and-krasdale-foods-draw-more-than-250-merchants-and-employees-to-annual-1/) [snippet]; [Jetro](https://www.retail-insight-network.com/news/newsnational-retail-solutions-and-jetro-partner-to-aid-independent-retailers-5725481) [snippet]; [Pitco](https://www.nosh.com/?p=103726) [snippet]
- Independent sales agents and ISOs sell POS and processing to these merchants, and the CSI study was written for them. Merchants trust manufacturers on product and merchandising but resist standardizing operations. [CSI Works 2025](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf) [opened]
- A Baltimore study suggests group bulk purchasing because stores share core suppliers. That is a proposal from the authors, not evidence that a co-op exists. [Mui et al. 2015](https://www.mdpi.com/1660-4601/12/12/14965) [opened]

### Inferences
- A realistic channel for reaching Baltimore owners is a KAGRO of Maryland letter plus an in-person visit, and a wholesaler such as B. Green or BJ's for scale. An app store listing alone would reach few owners.
- Korean should be the priority language for software aimed at Baltimore owners, then Spanish and Arabic. A Korean speaker should check any Korean screens before an owner sees them. Speech input may help owners who read English poorly.
- Trust runs through people the owner already deals with. Approach owners through the wholesaler rep or association officer, not a cold ad.
- Baltimore's Korean share has likely fallen from the old 75%, so do not quote that figure as current.

### Gaps
- Current share of immigrant owners by NAICS: Annual Business Survey cuts not retrieved. Current Baltimore ownership split: not found.
- Bengali, Gujarati and Amharic-speaking owner shares: no source found. Do not claim them without one.
- UGROC and NASGA: no search returned anything on these groups, so I cannot confirm what they do. National buying co-ops for bodegas: none found.
- KAGRO of Maryland's current membership: not found. Membership in other KAGRO chapters conflicts between sources, such as California at 6,200 and about 1,500.
- How owners decide on tools: no survey. CSI's inertia finding is the nearest evidence.

## Can customers reach them digitally?

### Takeaway
Delivery apps are becoming available through the POS, but I found no adoption data at all. The store's demand is walk-in traffic, so lead follow-up has little to work on.

### Cited findings
- NRS launched direct POS integration with Uber Eats on Aug 11, 2026, with live stock sync and orders in the NRS tool, for bodegas, convenience, liquor and specialty stores in the US and Canada. A release says it could reach tens of thousands of merchants. NRS added DoorDash and Grubhub links the previous year, per trade press. No adoption figures. [GlobeNewswire](https://www.globenewswire.com/news-release/2026/08/11/3342839/33173/en/index.html) [snippet]; [Retail Customer Experience](https://www.retailcustomerexperience.com/news/nrs-launches-direct-pos-integration-with-uber-eats/) [snippet]
- In 2022, NRS and Uber Direct offered same-day delivery from thousands of its stores through the BR Club app, at no cost to stores. [Supply Chain Dive](https://supplychaindive.com/news/uber-partnership-national-retail-solutions-same-day-delivery/637678) [opened]
- Restaurant commissions are the nearest public benchmark: Uber Eats fees ran up to 30% for small restaurants, in older reporting. Current 2026 rates I saw came only from third-party guides, so I left them out. No grocery or bodega rate found. [Restaurant Dive, older](https://www.restaurantdive.com/news/delivery-by-the-numbers-how-top-third-party-platforms-compare/564279/) [snippet]
- Shoppers, not owners: PAR's Aug 2026 survey of 1,000 adults found half consider a store over-automated if they cannot easily reach an employee. Commissioned by a POS vendor. [NACS on PAR, Oct 2026](https://convenience.org/stay-current/news/2026/october/5/par-consumers-value-fast-ai-checkout) [snippet]
- Traffic: 165 customers on an average day at Baltimore corner stores (2015), with 93% of Americans within 10 minutes of a convenience store (NACS). [Mui et al. 2015](https://www.mdpi.com/1660-4601/12/12/14965) [opened]; [NACS, May 2026](https://www.convenience.org/stay-current/news/2026/may/8/usda-releases-complex-overhaul-of-snap-stocking-requirements) [opened]

### Inferences
- If grocery commissions resemble restaurant ones, a fee near 30% would consume the 20 to 30% margin one owner gave for non-tobacco goods. Lottery and tobacco may also be limited on these apps, which I did not verify. Check both with an owner.
- A lead-response workflow built for service trades does not transfer. A service business with a lead queue has few, high-value inbound jobs, while a corner store has hundreds of small walk-in sales and no inbound lead queue. No source measures phone calls to corner stores, which itself suggests nobody treats them as a sales channel.
- A set of AI agents for a store would do different core work: supply, compliance and paperwork. A drafted task the owner approves would read "SNAP gap: add 2 dairy items," "Tobacco license renews in 30 days," or "This vape is on an FDA warning list." The trigger is a calendar, a rule or a photo instead of an inbound message.
- That also changes a 60-second onboarding profile. It needs store type, whether fuel is sold, license list, SNAP and WIC status, wholesaler names, POS or none, and language.

### Gaps
- Share of independents on DoorDash, Uber Eats or Instacart: not found. Delivery share of sales: not found.
- Google Business Profile claim rates, loyalty use and phone call volumes for independents: no source found. A quick manual sample of Baltimore stores in Google Maps could produce a small original number.

## Owner attitudes to AI and tech adoption

### Takeaway
There is no independent-only, non-vendor measure of AI attitudes in convenience retail. The vendor surveys report enthusiasm, while field evidence shows strong inertia, and the second is the better guide for a corner store.

### Cited findings
- Toast, 340 operators of convenience, grocery and bottle shops with 16 or fewer locations, Apr 3 to 20, 2026, margin plus or minus 5%, blind survey, includes non-Toast operators: nine in ten are experimenting with AI. 94% rate their business good or excellent, and 66% say they are likely to open a new location within a year. A summary adds that 75% plan to raise tech spending, from 64%. Vendor data. [Toast via 01net](https://www.01net.it/the-2026-voice-of-the-retail-industry-survey-how-u-s-retailers-are-feeling-about-inflation-expansion-ai-and-more/) [opened]; [TechEdge summary](https://techedgeai.com/toast-survey-finds-retailers-turning-to-ai-for-efficiency/) [snippet]
- PDI, convenience industry professionals, Nov 2025, sample size not stated: 72% call AI capability important when evaluating technology, and one-third are unsure how to deploy AI. No independent split. Vendor data. [PDI](https://pditechnologies.com/?p=25029) [opened]
- CSI's field visits found resistance to upgrading across all store types, even when shown modern options. [CSI Works 2025](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf) [opened]
- A Johns Hopkins team built BUD, a web app connecting Baltimore small-store owners to healthier suppliers, and piloted it in 38 corner stores as a randomized trial. I did not get outcomes before the search budget ended. [Trial record](https://ctv.veeva.com/study/a-mobile-application-to-improve-procurement-and-distribution-of-healthful-foods-beverages-in-balti) [snippet]

### Inferences
- A sample where 66% expect to open another location does not look like a family bodega, so Toast's nine in ten should not be quoted for corner stores.
- CSI's 42% on old registers, set against Toast's nine in ten, is the corner-store version of a wider gap between sources on small-business AI use. Census-based figures put it under 20% at firms with 1 to 4 employees, and owner surveys put it at 58% to 76%. [Census, May 2026](https://www.census.gov/library/stories/2026/05/ai-use-businesses.html) [secondary, not reopened]; [US Chamber, Aug 2025](https://www.uschamber.com/technology/empowering-small-business-the-impact-of-technology-on-u-s-small-business) [secondary, not reopened]; [Goldman Sachs, Mar 2026](https://www.goldmansachs.com/pressroom/press-releases/2026/small-businesses-embrace-ai-but-need-training-and-support-to-fully-harness-it) [secondary, not reopened]. With the vendor caveats shown, the corner-store comparison may be the stronger one.
- Owners who answer "it works" will not adopt a tool for general efficiency. A concrete fear with a date, like losing SNAP or a tobacco suspension, is the likelier opening.
- BUD is the closest prior art, and it is worth reading before any Baltimore claim, because it shows what an academic team learned from putting an app in front of these same owners.

### Gaps
- Any survey of independent or single-store owners on AI, or their smartphone and WhatsApp or KakaoTalk use: none found.
- BUD trial results and owner tech readiness: not retrieved. Start with the trial record above and search for the published paper.
