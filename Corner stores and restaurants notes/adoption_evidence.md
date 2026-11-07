# Corner stores and restaurants: adoption evidence, read as a skeptic

Checked Nov 6, 2026.

This note reviews how AI and technology adoption has gone at independent US corner stores and restaurants, and weighs two designs for helping these owners. "A phone-run set of AI agents" means an owner talks to set it up, then approves drafted tasks through the day. "Assisted tool adoption" means a person helps an owner compare existing tools and switch one on in a short session, then checks later whether it stuck.

How to read the tags:
- **[snippet]** means I read only a search result summary, because the page was blocked or I did not open it. Open it before relying on it. Untagged links were opened.
- **[secondary, not reopened]** means the fact and its link come from an earlier research pass, and I did not reopen the page for this note.
- **Vendor data** means the source sells the product or something competing with it.
- **Older** marks data from before 2022.
- **Inference (mine)** marks my reasoning, not a finding.

The search budget for this note ran out before four checks, listed under Gaps in the relevant sections.

## Can a voice-onboarded set of AI agents run these chores through a phone?

### Takeaway
I found no independent evidence that it can, for any store of this size. The closest real-world cases point the other way: the most advanced vendors put paid humans behind the AI, the chains that automated the most pulled back at busy hours, and one tablet pilot lost 1 of 4 corner store owners to the time cost of tapping alone.

### Cited Findings
- Toast's AI marketing product runs with a paid human layer. Its CEO described "marketing success managers reviewing and approving that work" on the Q2 2026 call. Vendor data, and the call gave no usage or conversion figures: [third-party transcript](https://transcripts.platformaeronaut.com/transcripts/TOST-2Q26-transcript).
- Presto, sold to restaurants as automated order-taking, settled with the SEC on Jan 14, 2025. The SEC found human order takers abroad processed the vast majority of orders, and over 70% of orders on its in-house version needed human intervention: [SEC summary](https://www.sec.gov/enforcement-litigation/administrative-proceedings/33-11352-s) [snippet]; [Ropes & Gray](https://www.ropesgray.com/en/insights/alerts/2025/01/ai-washing-enforcement-in-the-final-days-of-the-gensler-administration) [snippet].
- Baltimore's POST pilot gave 4 corner store owners a 14-item tablet that logged sales with a tap. Training took about five minutes. 3 of 4 finished 11 days, and the fourth quit, citing a busy store and too few staff. Run by academic researchers who sell nothing; the data dates from 2019: [PMC8883529](https://pmc.ncbi.nlm.nih.gov/articles/PMC8883529/).
- An unguided AI mentor on WhatsApp gave Kenyan owners no average gain: [Berkeley Haas](https://newsroom.haas.berkeley.edu/research/gen-ai-experiment-shows-mixed-results-in-helping-small-businesses-grow/) [secondary, not reopened]; [HBS and HKS working paper](https://www.hks.harvard.edu/centers/cid/publications/uneven-impact-generative-ai-entrepreneurial-performance) [secondary, not reopened]. An SMS version is covered below.

### Inferences
- Inference (mine): a phone-run set of AI agents built around following up web leads is aimed at the wrong work for these two trades. Some service businesses wait on web leads. A restaurant's demand arrives as a live call or a walk-in, which cannot wait for an owner's approval, and a corner store has no leads at all. Its chores are ordering, invoices, compliance and promotion paperwork.
- Inference (mine): an hours-saved counter built from approved tasks and the share of actions approved from the phone both measure tapping. A shop could score high on either while saving nothing, so neither would survive anyone asking how the hours were measured.
- Inference (mine): the part of a phone-run set of AI agents that the evidence supports is narrow. Plain code that holds outbound messages until a human approves is a sound guard, and a single morning brief fits how these owners work. Treating the agents as a staff, running 3 to 4 of them and feeding the owner a stream of approval tasks are all unsupported.

### Gaps
- No independent test of multi-agent chores in any shop under about 20 staff turned up. Absence of evidence here is a real finding, since no one has published it, but it is not proof that it cannot work.

## Measured outcomes of AI in independent and small restaurants

### Takeaway
Nearly every number comes from the seller. I found no independent evaluation of AI phone answering, invoice automation or scheduling in independent restaurants. The one independent look at a named owner, from the Boston Globe, shows both a tool the owner relies on and a customer who stopped ordering.

### Cited Findings

| Case | What was measured | By whom | Sample | Seller? |
|---|---|---|---|---|
| Tony Naser, Crush Pizza and Mickey's N.Y. Pizza | Of 1,700+ Google reviews, 20 mention AI or robot phones, most of those 1 or 2 stars; at least 1,000 calls a month per store | [Boston Globe, Jan 2026](https://www.bostonglobe.com/2026/01/18/business/ai-restaurants-phone-pizza/) | 3 stores | No for the review count. Loman's own claims in the article (98.6% accuracy, 26% more phone revenue, $2,500 a month saved per store, 16% larger orders) are **vendor data** |
| Costa Alexandrou, Nick's Place | Deployed Loman at 3 of 12 locations after counter staff left | Boston Globe, same article | 12 locations | No, but no outcome number |
| Red Rocks Cafe, Charlotte | 3,088 calls in 90 days, 60% handled with no human, 97% answered | [Slang case study](https://www.casestudies.com/company/slangai/case-study/how-red-rocks-cafe-fully-automates-60-of-calls-with-voice-ai) | 2 locations | **Vendor data** |
| Taqueria El Arquito | Phone orders "tripled" with no before or after figures. Phone was 45% of sales, 85% of calls in Spanish, 10% to 15% of orders lost in rushes | [Loman case study](https://www.casestudies.com/company/loman/case-study/taqueria-el-arquito-triples-phone-orders-with-loman) | 1 restaurant, location not stated | **Vendor data** |
| PLANTA | 87,578 calls in a year, 50% fully handled, 3,598 reservations | [Slang case study](https://www.casestudies.com/company/slangai/case-study/planta-answers-87578-calls-with-slangai) [snippet] | A chain, not an independent | **Vendor data** |
| Maple platform | 1M+ calls, 92% resolved without staff | [Verdict Foodservice](https://www.verdictfoodservice.com/news/maple-links-voice-ai-with-opentable/) [snippet] | Platform-wide | **Vendor data** |
| Spirits Food and Friends, Louisiana | Agency spend down 70%, over 100,000 in marketing-attributed sales in under two months, from Toast IQ Grow | [Toast Q2 2026 call](https://transcripts.platformaeronaut.com/transcripts/TOST-2Q26-transcript) | 1 restaurant group, called an example by management | **Vendor data** |
| Scheduling | 8% to 15% labor savings claimed by Shyft, up to 15% by TimeForge citing an unnamed study | [Shyft](https://www.myshyft.com/?p=43101) [snippet]; [TimeForge](https://timeforge.com/?p=32814) [snippet] | Not stated | **Vendor data** |

- Invoice automation has no measured outcome in anything I found. Vendor pages describe hours saved in words only, for example [Supy](https://supy.io/blog/ai-invoicing-2026-how-restaurants-cut-manual-labor-best-practices-for-f-b-success) [snippet]. MarginEdge publishes a price but no outcome study: [MarginEdge pricing](https://www.marginedge.com/pricing).
- Loman reports that 66% of its restaurant clients cut labor through staff reductions and 34% kept staffing the same. Vendor data, reported in the [Boston Globe](https://www.bostonglobe.com/2026/01/18/business/ai-restaurants-phone-pizza/).
- Abandonment, usage side: about 40,000 of 171,000 Toast locations using Toast IQ weekly, about 23%, from the [Toast Q1 2026 call](https://www.fool.com/earnings/call-transcripts/2026/05/07/toast-tost-q1-2026-earnings-call-transcript/) [secondary, not reopened], stays the best number in the sector. It is vendor data and measures use, not churn. Toast gave no updated usage figure in the [Q2 2026 call](https://transcripts.platformaeronaut.com/transcripts/TOST-2Q26-transcript).
- Abandonment, churn side: I found no credible churn figure for AI tools in restaurants. The only related base rate is closures: independent restaurant locations fell from 422,001 in 2024 to 412,498 in 2025, down 2.3%, per Technomic in [NRN](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025) [snippet]. Technomic sells data, not restaurant tools.
- Marketing has a public backlash case. Austin restaurants reportedly dropped AI-made social images after customer complaints, per [mySA](https://www.mysanantonio.com/business/article/austin-restaurants-ai-backlash-22463168.php) [snippet, page failed to load], and a San Francisco restaurant drew backlash for AI menu photos, per [NBC Bay Area](https://www.nbcbayarea.com/news/local/restaurant-backlash-ai-menu-san-francisco/4115961/) [snippet].

### Inferences
- Inference (mine): "handled with no human" is the same kind of number the SEC called misleading in the Presto case, so treat it as untested until a source says how it counts a caller who hangs up or calls back. Wendy's own two figures show the gap, covered in the next section.
- Inference (mine): the phone is the best-evidenced job, and only on volume. Answering calls is measured, while whether those calls became revenue the store would otherwise have lost is not.
- Inference (mine): 20 of 1,700 reviews is about 1.2%, small but one-sided. Few unhappy callers will review, and the owner cannot see the ones who quietly stop ordering. The Globe names one customer who stopped.
- Inference (mine): for assisted tool adoption, a proven-in-similar-shops rating will have nothing to read from for a long time, since no outside data exists to seed it.

### Gaps
- I found no independent before-and-after study of AI phones, invoice capture or AI scheduling at independents. I also found no published churn rate from Slang, Loman, Maple, Hostie or MarginEdge.
- Rejected as unreliable: a [Glama demo transcript](https://glama.ai/mcp/servers/@WGalyean50/salesloft-mcp-demo1/blob/80732d043986ec3adb5cb35b23044ca4f2b116e4/transcripts/TRANSCRIPT_SUMMARY.md) with churn figures, [ZipDo](https://zipdo.co/restaurant-management-software-industry-statistics/) with no method, a [DSM.promo case](https://dsm-promo.pages.dev/case-studies/restaurant.md) claiming 35% labor savings, and Hostie's and Loman's "benchmarks" of their own rivals.

## Public failures and which lessons reach a single store

### Takeaway
The failures teach three things that apply to one store: AI breaks first at the rush, accents still trip it, and "automated" numbers hide human labor. Their capital risk and brand-scale trolling mostly do not apply.

### Cited Findings

| Case | What was measured | By whom, sample | Seller? |
|---|---|---|---|
| McDonald's and IBM | About 100 locations from Oct 2021, ended by July 26, 2024. Order accuracy in the low 80s against a 95%+ goal | [NRN](https://www.nrn.com/quick-service/mcdonald-s-is-ending-its-ai-drive-thru-test-with-ibm) [snippet]; [AP via ABC](https://abcnews.go.com/US/wireStory/mcdonalds-ending-test-run-ai-powered-drive-thrus-111236274) [snippet]; BTIG analyst report from 2022, reported secondhand | No. McDonald's declined to comment on accuracy. The accent point comes from unnamed sources |
| Taco Bell | 500+ drive-thrus and 2M+ orders, no accuracy figure. Its digital chief said AI may not fit very busy restaurants with long lines | [WSJ, syndicated, Aug 2025](https://www.itiger.com/news/2562303742) | Operator's own statement. The 18,000-water story is a viral anecdote, not a measurement. I found no 2026 update |
| Amazon Just Walk Out | About 700 of 1,000 sales reviewed in 2022 against a goal of 50. Amazon disputes this and says the India team only helped train the model | The Information via [Business Standard](https://business-standard.com/companies/news/amazon-s-just-walk-out-checkout-tech-was-powered-by-1-000-indian-workers-124040400463_1.html) [snippet], unnamed source | Amazon sells it. Removed from Fresh in 2024. All 72 Go and Fresh stores closing per [Axios](https://www.axios.com/2026/01/27/amazon-fresh-stores-closing-whole-foods-expansion) [snippet], which is a broader retreat than the checkout tech. Amazon still claims 360+ third-party sites: vendor data |
| Wendy's FreshAI | About 99% "success" counts orders a human had to fix, against 86% with no staff help. 80 basis points of margin at company stores | Trade coverage such as [Restaurant Business](https://www.restaurantbusinessonline.com/technology/wendys-expanding-its-drive-thru-ai-test) [snippet, exact page for each figure not confirmed] | Operator self-report. I found no independent test or 2026 status |
| Presto | Over 70% of orders needed a human, and 100% at some sites | [SEC](https://www.sec.gov/enforcement-litigation/administrative-proceedings/33-11352-s) [snippet] | Regulator's finding against the seller |

Diner attitudes:
- Gartner, Dec 2023, 5,728 customers across industries: 64% would prefer companies not use AI in customer service, 53% would consider switching, and 60% worried about reaching a person. Gartner sells advice, not this product: [Gartner](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service) [snippet].
- PAR Technology, June 2026, 1,000 US adults: 44% say AI goes too far when they cannot easily reach a person, and 47% when it replaces most human contact. Discomfort fell from 41% to 27%. Vendor data: [QSR Web](https://www.qsrweb.com/news/3-in-4-diners-open-to-restaurant-ai-par-survey-finds/) [snippet].
- Harris Poll for Hostie: 58% say their restaurant calls go unanswered, 69% would give up, and 89% are open to AI agents. Vendor-commissioned, so read it as the seller's best case: [Hostie](https://hostie.ai/blogs/missed-connection-over-two-thirds-of-americans-would-ditch-restaurants-that-dont-answer-the-phone) [snippet].
- Luo and colleagues, 2019, older, 6,200+ customers on outbound sales calls at a financial firm: telling people it was a bot before the call cut purchases by 79.7%. Academic, not restaurants: [IDEAS](https://ideas.repec.org/a/inm/ormksc/v38y2019i6p937-947.html) [snippet].
- Named harm: two customers in the [Boston Globe](https://www.bostonglobe.com/2026/01/18/business/ai-restaurants-phone-pizza/) could not get a fix for a wrong or missing order. One was stuck in a phone loop over several calls, and the other has not ordered since.

| Lesson | Reaches a single store? |
|---|---|
| AI fails at the rush, so a human should take over | Yes, and harder. Inference (mine): one owner has no spare staff to step in, and the rush is when the phone matters most |
| Accents and dialects hurt accuracy | Yes. The same class of speech models is in use, and these owners' customers and the owners themselves are often multilingual |
| Automation numbers hide human labor | Yes, as a buying rule. Ask each vendor who handles the failed share and what counts as resolved. This is a concrete check for comparing tools |
| Complaints need a route to a person | Yes. Fix-my-order calls are where the Globe's customers got stuck, so the tool should pass those on and take only simple ones |
| Trolling at brand scale | Mostly no. Inference (mine): a corner pizzeria is not a viral target, though a few one-star reviews weigh more on a small listing |
| Sunk capital and pilot costs | No. Inference (mine): a monthly tool can be cancelled, and that is the main advantage of a small store. Amazon's camera build-out has no small-store analog |
| Margin gains from redeploying order takers | Mostly no. Inference (mine): Wendy's 80 basis points needs labor at scale to cut. A store where the owner answers the phone has no such line to save |

### Inferences
- Inference (mine): disclosure pulls against adoption. Maryland requires every party's consent to record a call, per [RCFP](https://www.rcfp.org/reporters-recording-guide/maryland/) [secondary, not reopened], while Luo suggests disclosure can cost sales. No restaurant data tests this, so any comparison of these tools should state the legal duty and not promise neutral results.

### Gaps
- I found no independent, restaurant-specific survey of diners on AI phones, and no report of an independent restaurant that dropped an AI phone after complaints. My search did not surface Eater or New York Times coverage, so this may be a search limit.

## Corner store technology adoption history

### Takeaway
Independents adopted when someone else paid or a customer flow forced it, such as debit cards, tobacco scan rebates or distributor deals. Program evidence shows heavy, repeated in-person support. I found no NYC POS grant at all, and nothing that measures AI in a corner store.

### Cited Findings
- **Baseline.** USDA found 63% of small SNAP retailers lack equipment to identify eligible items, 42% have no scanning system, cost is the top barrier, compliance would average $7,000 to $10,500, and 59% of nonadopters would adopt to keep SNAP. Government, sells nothing. The page shows no sample or study date, and was updated Jan 2025: [USDA FNS](https://fns-prod.azureedge.us/research/snap/scanner-capability-assessment-snap-authorized-small-retailers).
- **Baltimore.** Authors say most Baltimore corner store owners have no electronic POS and keep no formal stock or sales records, and estimate 525 to 600 independent stores: [POST, PMC8883529](https://pmc.ncbi.nlm.nih.gov/articles/PMC8883529/). POST did not test data accuracy and covers 14 of 500+ items.
- **Baltimore Healthy Stores.** Older, about 2010. Quasi-experimental, 7 corner stores and 2 supermarkets against 6 and 2. Stocking and reported sales of some promoted foods rose. It took Korean-language materials and cultural guidelines, and owners said they do not stock what customers do not buy. Authors estimate 75% of small food stores in Baltimore are Korean American-owned, an older figure others dispute: [Public Health Nutrition](https://www.cambridge.org/core/journals/public-health-nutrition/article/corner-store-intervention-in-a-lowincome-urban-community-is-associated-with-increased-availability-and-sales-of-some-healthy-foods/1788BCB3E5EEE4488A7FD2971E219C24) [snippet]; [process evaluation](https://episeminars.web.unc.edu/wp-content/uploads/sites/7549/2014/09/Gittelsohn-Health_Promot_Pract-2010.pdf) [snippet].
- **Philadelphia.** Older, 2013. The Food Trust put touch-screen POS in six stores for 10 months, and staff scanned inventory to build a 10,000+ product database. Reliability was the question, and I found no answer. Nonprofit: [APHA abstract](https://apha.confex.com/apha/141am/webprogram/Paper283135.html) [snippet, blocked]. Grist counts five stores: [Grist](https://grist.org/food/a-fresher-philly-fruits-veggies-make-a-comeback-in-the-citys-corner-stores) [snippet].
- **DC Healthy Corners.** 54 stores, 33 taking SNAP Match, sales up 16% since Oct 2022, about $1M in incentives since 2018. Support includes training, equipment, marketing, a food hub and Community Store Navigators. Published by the operator, a nonprofit: [DC Central Kitchen](https://dccentralkitchen.org/2023/09/20/12-years-of-healthy-corners-how-the-seeds-we-planted-are-still-sprouting-new-roots/). American University evaluates it with intercept surveys and a scorecard: [AU 2024](https://aura.american.edu/articles/report/AU_DCCK_Report_2024_FINALHealthy_Corners_2024_Evaluation_Balancing_Store_Performance_Customer_Needs_to_Promote_Fresh_Produce_Access_Consumption/27278199/3) [snippet, blocked].
- **San Francisco.** Older, 2016. Healthy Retail SF paid up to 50% of a POS, capped at $1,000, with merchant incentives near $24,000 before staff time. Of 24 Tenderloin stores approached, 17 non-participants were interviewed, 11 uninterested. About 90% of those interviewed were Middle Eastern or South Asian, and 2 were not interviewed because they did not speak English. Concerns: low demand, spoilage, space, and vendor return limits. Academic: [PMC6200316](https://pmc.ncbi.nlm.nih.gov/articles/PMC6200316/). The city reports 25% average sales growth with no method I could find: [city release](https://oewd.org/sites/default/files/News/Press%20Release/10.26.16%20San%20Francisco%20Announces%20Results%20from%20HealthyRetailSF%20Report.pdf) [snippet].
- **Mexico.** 2009 to 2012, older, published later. A debit card rollout raised corner store POS adoption 18% after two years, and sales 6% and profits 19%. Owners underestimated the gain. Survey of 1,760 stores plus central bank data. Academic: [IPA](https://poverty-action.org/assessing-adoption-point-sale-technology-corner-stores-mexico).
- **US scanners, historic.** Older, 1972 to 1982. Scanners raised labor productivity about 4.5%, and the barrier was profitability against fixed costs: [Basker, NBER](https://www.nber.org/papers/w17825).
- **Who sold POS at scale.** NRS, owned by IDT, grew from 1,700 customers in its first year ([IDT, 2017](https://www.idt.net/nrs-achieves-success-helping-independent-retailers-compete/) [snippet]) to about 40,400 terminals at about 35,000 stores, against its own estimate of 200,000 target retailers. It sells through wholesale distributors, sales agents and telemarketing: [IDT FY2026 10-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm). Filed by the seller.
- **Scan data.** Retailers get tobacco rebates for sharing POS data through a certified provider. One vendor's illustration shows $208 a month gross, $178 net of a $30 fee, and terms vary. Vendor data: [FTx](https://goftx.com/blog/retail-scan-data/) [snippet]. NRS built Altria's Tier 4 program into its POS: [Retail Customer Experience](https://www.retailcustomerexperience.com/press-releases/national-retail-solutions-nrs-deploys-altria-tier-4-program-across-point-of-sale-network/) [snippet].
- **Delivery.** Bodega owners asked City Hall in 2021, older, for help using the tech that rapid-delivery apps use: [Brooklyn Reader](https://bkreader.com/2021/12/06/we-need-help-to-survive-bodega-owners-call-for-support-from-the-city/) [snippet]. NRS and Uber launched delivery in Nov 2022 at 700+ tri-state stores, with a $2.99 customer fee and no retailer fee through its app. No results were reported: [Supermarket News](https://www.supermarketnews.com/foodservice-retail/nyc-bodegas-to-offer-delivery-under-new-uber-eats-partnership).
- **SNAP online.** Online reached 8.8% of redemptions by late FY2023 ([USDA ERS](https://ers.usda.gov/data-products/charts-of-note/110132) [snippet]). Small stores face a multi-step approval and item categorization, and early adopters were large chains ([Modern Retail, 2021](https://www.modernretail.co/retailers/why-many-online-grocers-still-cant-accept-snap-customers/) [snippet]). USDA gave the National Grocers Association $5M for technical help to independents ([Grocery Dive](https://www.grocerydive.com/news/usda-grocery-diversity-independents-snap-online/626822/) [snippet]).
- **NYC programs I could find.** Storefront upgrades with LISC and Citi ([6sqft](https://www.6sqft.com/?p=66972) [snippet]) and panic buttons distributed through a bodega trade group ([Fox 5](https://www.fox5ny.com/news/nyc-bodegas-get-1m-in-funds-for-increased-security) [snippet]). NRS, City Harvest, United Bodegas of America and NYC EDC ran a joint event ([CSP](https://cspdailynews.com/technologyservices/pos-network-supports-nyc-bodegas) [snippet]).

### Inferences
- Inference (mine): every adoption wave has an outside push: a card that customers carry, a rebate, a threat of losing SNAP, or a free delivery deal. "Saves you time" alone has no track record in this segment.
- Inference (mine): corner store programs that worked sent people back repeatedly and paid thousands of dollars per store. A single 45-minute setup session has no precedent here. Those programs also changed stock, not software, so they are only a rough guide.
- Inference (mine): tobacco money funds a share of corner store tech. A publicly funded or university-linked program should say plainly that it will not route owners into those rebates by default, and should expect the question.

### Gaps
- I found no NYC grant for bodega POS or "digitization," so this may be the wrong name for it. The United Bodegas of America or NYC SBS could confirm. I could not open the American University reports or the USDA full study.
- I found no independent evidence on digital coupon adoption at independents, and no report of AI in a corner store with outcomes.

## Approval fatigue and approve, edit or skip requests

### Takeaway
No study counts approvals by restaurant or store owners, so any daily number is a judgment. The nearest evidence says acceptance falls as volume rises, repeats hurt most, and people end up accepting almost everything. My estimate is 3 to 5 real decisions a day, batched outside the rush.

### Cited Findings
- Ancker and colleagues, 2017, older. 112 primary care clinicians, 1.27M advisories. Each extra advisory per encounter meant 30% lower acceptance, and each 5-point rise in repeats meant 10% lower acceptance. General workload had no effect, and there was no sign of slow desensitization to new alerts. Academic: [PMC5387195](https://pmc.ncbi.nlm.nih.gov/articles/PMC5387195/).
- A 2020 review of 23 articles found override rates of 46.2% to 96.2%: [JMIR](https://medinform.jmir.org/2020/7/e15653) [snippet]. A 2025 preprint pooled 44 studies at 79.8%, not peer reviewed: [JMIR preprint](https://preprints.jmir.org/preprint/88578) [snippet].
- Anthropic says Claude Code users "accept 93% of them anyway" for permission prompts, and describes people ceasing to pay close attention. Developers, not owners. Vendor data from a company with a product that replaces those prompts: [Anthropic](https://www.anthropic.com/engineering/claude-code-auto-mode). Later coverage cites 97%, unverified: [DevOps.com](https://devops.com/anthropic-makes-claude-codes-auto-mode-the-default-betting-automation-beats-manual-review/) [snippet].
- People who got notifications all day showed more inattention than those who got batches. Kushlev, 2016, older: reported in [arXiv](https://arxiv.org/pdf/1612.02314) [snippet, secondary].
- Owners using Marblism spend 10 to 30 minutes a day approving work, per a weak review source: [Crevio](https://crevio.co/blog/marblism-review) [secondary, not reopened].
- POST lost 1 of 4 owners to time pressure at one tap per sale: [PMC8883529](https://pmc.ncbi.nlm.nih.gov/articles/PMC8883529/).
- Square says Managerbot "does not act on its own": [Square](https://squareup.com/us/en/press/managerbot-open-beta) [secondary, not reopened]. So approval-first design is now common and does not set a phone-run set of AI agents apart.

### Inferences
- Inference (mine): clinicians are trained and alerts are safety-critical, so owners with no such training and a line at the counter will likely do worse. This is a transfer from another field, not a finding about owners.
- Inference (mine): Ancker found workload itself did not matter, while count and repeats did. That points to fewer and less repetitive requests, not to better timing alone. An agent that chases a quote with follow-ups on days 1, 3 and 7 repeats by design.
- Inference (mine): a high approval rate is the warning sign. If a phone-run set of AI agents hits 93%, the approval no longer protects customers, and a dashboard that counts approvals would show it as success.
- Inference (mine): design changes the evidence supports:
  - Cap requests at about 5 a day and batch them before open and after close.
  - Make Skip the default on timeout, and never send on silence.
  - Show one reason to doubt on each request.
  - Group repeats into one request.
  - Report edit rate, skip rate and time to decide in place of the approval share.
  - Reserve real-time requests for the one job that pays for the interruption, and test whether the owner can act on it at the rush.
- Inference (mine): a fast reply from a phone-run set of AI agents only holds when the owner is free. In a restaurant, the same moment is usually the rush.

### Gaps
- No field study covers approval rates, skip rates or decay among small business owners using agent approval requests. A pilot could be the first to publish one.
- I did not check the 2024 and 2023 oversight studies cited on blogs such as [tianpan.co](https://tianpan.co/blog/2026/06/25/approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps) [snippet], since the primary papers did not surface. I left their numbers out.
- Self-reported hours are a known weak measure, and I meant to add large-sample studies of AI time savings. The search budget ran out before I could verify them, so I cite none here.

## Voice and low-literacy interfaces, and messaging services for micro-merchants

### Takeaway
Voice onboarding is plausible in a quiet moment with a helper and risky alone in a kitchen. Abroad, messaging reached many merchants, but money came from what merchants sold or borrowed through the app, and unguided messaging training faded to nothing within a year.

### Cited Findings
- Koenecke and colleagues, PNAS 2020, older, 19.8 hours from 115 speakers across five commercial systems. Error rates were 0.35 for Black speakers and 0.19 for white speakers, and very high error rates occurred in over 20% against under 2% of samples. Academic: [Stanford](https://news.stanford.edu/stories/2020/03/automated-speech-recognition-less-accurate-blacks) [snippet].
- A 2025 preprint on non-native English with L1 Arabic, Chinese, Hindi, Korean, Spanish and Vietnamese found the best mean match error near 0.054 for read speech (Whisper, 24 speakers) and 0.063 for spontaneous speech (RevAI, 22 speakers). The two are not directly comparable, and these are clean recordings: [arXiv 2503.06924](https://arxiv.org/abs/2503.06924).
- Noise: some background sounds pushed Whisper's word error past 50% in an academic test, with no kitchen tested: [arXiv 2307.03183](https://arxiv.org/pdf/2307.03183.pdf) [snippet]. Noise filtering before transcription can make results worse, per a company study presented at ICAART'24: [Alcatel-Lucent Enterprise](https://www.al-enterprise.com/en/blog/noise-reduction-study-asr) [snippet].
- McDonald's: unnamed sources told CNBC that accents and dialects caused trouble: [NRN](https://www.nrn.com/quick-service/mcdonald-s-is-ending-its-ai-drive-thru-test-with-ibm) [snippet].
- **Kenya SMS training, randomized.** About 4,700 micro-entrepreneurs. 30% started and 7% completed, against forecasts of 50% and 40%. Three-month gains were gone by 12 months on knowledge, practices, sales, profits and survival. Owners would pay a small amount for more. Academic: [CEGA](https://cega.berkeley.edu/article/short-messages-fall-short-for-micro-entrepreneurs-experimental-evidence-from-kenya/).
- **WhatsApp advisory group.** 19 of 20 agents exchanged 600+ messages over 6 weeks. Small, non-randomized, human-run: [BFA](https://bfaglobal.com/fibr/insights/micro-consulting-using-whatsapp-groups-to-support-agents/) [snippet].
- **WhatsApp Business case studies**, such as 41% of sales through WhatsApp at Asomkriti, are vendor data: [Meta](https://www.casestudies.com/company/whatsapp/case-study/asomkriti-customer-case-study) [snippet].
- **Khatabook, India.** FY22 revenue Rs 71.1 crore, losses Rs 111.1 crore, repeated layoffs, closed its MyStore e-commerce product, and turned toward lending and paid software. An outside analyst argues the ledger had no direct revenue because merchants do not value tech above labor. Company figures in trade press, no churn data: [Inc42](https://inc42.com/buzz/khatabook-fires-over-40-employees-restructuring-exercise) [snippet]; [DT Next](https://www.dtnext.in/news/business/digital-lending-platform-khatabook-lays-off-over-40-employees-734296) [snippet]; [Substack](https://ameya.substack.com/p/how-khatabook-became-the-premier) [snippet].
- **Bukalapak, Indonesia.** 14.2M registered partners by mid-2022 (vendor data: [Fortune IDN](https://www.fortuneidn.com/tech/luky/jumlah-mitra-mencapai-14-juta-bukalapak-fokus-bantu-digitalisasi-umkm) [snippet]), yet a Nielsen survey of 2,736 warungs found 25% had started to digitize, and its sponsor is unclear ([DealStreetAsia](https://events.dealstreetasia.com/introducing-the-warung-tech-index-a-data-driven-view-on-the-digital-journey-of-traditional-trade-in-indonesia/) [snippet]). It closed its physical goods marketplace in Feb 2025, under 3% of revenue, and kept virtual products: [Jakarta Post](https://www.thejakartapost.com/business/2025/01/08/bukalapak-to-cease-sales-of-physical-products-on-marketplace) [snippet]. Competition from TikTok Shop and Shopee drove that, not warung failure: [Bloomberg](https://www.bloomberg.com/news/articles/2025-01-08/tiktok-alibaba-push-indonesia-pioneer-bukalapak-into-retreat) [snippet].
- **BEES, AB InBev's ordering app.** 3.4M monthly users as of Sept 2023, across small retailers. Vendor data: [Digital Commerce 360](https://www.digitalcommerce360.com/2023/12/11/ab-inbev-reports-growth-digital-bees-marketplace/) [snippet].
- **US WhatsApp reach.** Pew figures for Hispanic adults run 54% to 56% in secondary reports, and Asian adults 39% to 51%, against about 32% overall. They conflict, and I did not reach Pew: [Sinch](https://sinch.com/de/?p=208538) [snippet]; [Latin Times](https://www.latintimes.com/latinos-dominate-social-media-leading-usage-tiktok-instagram-whatsapp-across-us-551034) [snippet].

### Inferences
- Inference (mine): 60 seconds of voice setup is the easy part. The hard part is that a misheard price or service goes into the stored business profile and then into every drafted task that quotes it. A confirm screen helps, but it needs an owner who reads English well enough to catch the error.
- Inference (mine): do onboarding with a helper present, outside the rush, and let typing and tapping stand in for voice. This favors the in-person setup in assisted tool adoption.
- Inference (mine): the merchant apps abroad that scaled carried inventory, credit or supplier ordering. A US corner store app that only saves time would lack that revenue, as Khatabook's history suggests. BEES and NRS are the US-relevant versions, both paid for by suppliers or payment flows.
- Inference (mine): WhatsApp fits Spanish-speaking owners better than an unregistered text number, though evidence for it in US corner stores is absent. Sending texts through Twilio has its own 10DLC delay: [Twilio](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc) [secondary, not reopened].

### Gaps
- I found no measured voice accuracy in a working kitchen or store, no figures for Bengali-accented or Yemeni Arabic-accented English, and no evidence on low-literacy voice interfaces for US merchants. No randomized evaluation of WhatsApp for micro-merchants in Latin America or India surfaced.
- WhatsApp's policy on general-purpose AI bots may limit a set of AI agents on that channel. I could not verify this before the search budget ran out, so check it before planning to run agents on WhatsApp.
- I found no evidence Warung Pintar failed, and no churn figures for any overseas merchant app.

## Reach and trust channels

### Takeaway
For corner stores, the channel with proven scale is the wholesaler and the sales agent, not a public program. Student squads have reached many shops, but no independent study shows lasting use. SBDC impact studies are program-backed, cover only clients with 5+ hours, and count impact only from clients who say the help was beneficial.

### Cited Findings
- NRS sells through wholesale distributors, dedicated agents and telemarketing: [IDT 10-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm). It partners with Krasdale ([Retail Customer Experience](https://www.retailcustomerexperience.com/news/national-retail-solutions-krasdale-foods-team-to-empower-bodegas/) [snippet]), Jetro ([Retail Insight Network](https://www.retail-insight-network.com/news/newsnational-retail-solutions-and-jetro-partner-to-aid-independent-retailers-5725481) [snippet]) and Pitco ([Nosh](https://www.nosh.com/?p=103726) [snippet]).
- In the UK's Help to Grow scheme, 27% of firms arrived through their software vendor against 8% through search: [Help to Grow: Digital evaluation](https://assets.publishing.service.gov.uk/media/65a6a60864060200143cb791/help-to-grow-digital-final-report.pdf) [secondary, not reopened]. NFIB puts vendors at 28% as the source of owners' latest technology idea: [NFIB 2025](https://www.nfib.com/wp-content/uploads/2025/06/2025-NFIB-Technology-Survey-1.pdf) [secondary, not reopened].
- **Digital Main Street, Ontario.** The closest match to a model of trained helpers visiting shops. Older, April 2020, self-published progress report, no independent evaluation found. $12M program, $10,000 squad grants, squads of trained members and recent graduates visiting shops for free. Funnel: 9,188 assessments, 5,657 in online training, 2,553 grant applicants, 2,165 $2,500 grants. Grant recipients: retail 36.1%, food and beverage 10.6%, restaurants 9.5%. Spending went 41% to digital marketing and 35% to websites, with 13% on software. The report counts activity, not lasting use: [Ontario DMS report](https://research.degroote.mcmaster.ca/wp-content/uploads/sites/98/2024/07/Perception-and-Action-in-a-Shifting-Retail-World-OntarioDMS_April2020ProgressReportHR.pdf). Later reports cite 45,000 businesses and 600 jobs ([Observer](https://observerxtra.com/digital-main-street-program-provided-aid-to-thousands-of-small-businesses) [snippet]). Kitchener used 22 students for 2,200 businesses ([Kitchener](https://lf.kitchener.ca/WebLinkExt/0/doc/1975611/Page1.aspx) [snippet]).
- **SBA Community Navigator Pilot.** $99.9M, Dec 2021 to May 2024, hub-and-spoke through trusted local groups. SBA's own evaluation found 75%+ of surveyed clients satisfied and more trust in SBA: [summary](https://optimalsolutionsgroup.com/2024/06/11/community-navigator-pilot-program-evaluation/). GAO found it reached more clients in high-minority and high-poverty areas, but SBA had no plan to evaluate outcomes, and the recommendation remained open: [GAO-25-107067](https://www.gao.gov/products/GAO-25-107067). OIG also found measurement gaps: [SBA OIG](https://www.oversight.gov/reports/audit/sbas-oversight-community-navigator-pilot-program-performance) [snippet].
- **SBDC impact.** Chrisman's national study, 2020 to 2021, older: long-term means 5+ hours of counseling. 14.5% response. Only clients who said services helped were counted. $10.1B in sales and a 4.02 to 1 benefit-cost ratio. The network's own publication: [America's SBDC](https://americassbdc.org/wp-content/uploads/2022/11/SBDC-A-NATIONAL-2020-2021-impact-study1884.pdf) [snippet]. A 2023 to 2024 study exists, and I could not get its text: [America's SBDC](https://americassbdc.org/impact/) [snippet].
- **SBDC client mix by sector** is only available state by state and is not comparable. Retail 12.4% in New Hampshire 2025 ([Manchester Ink Link](https://manchester.inklink.news/?p=274554) [snippet]). Retail 16.9% and food service 12.7% in Arkansas, older ([ASBTDC](https://asbtdc.org/?p=4566) [snippet]). Outcomes by sector did not surface.
- **Consulting trials, abroad.**
  - Mexico, older, published 2018: 432 firms, 150 offered 70% to 90% subsidized consulting at 4 hours a week for a year. 80 took it, and most who declined cited the fee. Productivity up 0.21 SD, employment up over five years: [IPA](https://poverty-action.org/boosting-firms-productivity-mexico-consulting-services).
  - Nigeria, older, data from 2016 to 2019: 753 firms of 2 to 15 workers. Training at about $2,000 per firm had no significant effect on practices. Subsidized specialists at the same cost raised digital marketing a lot, and outsourcing raised profits about $98 a month. Consulting cost $4,000 and also worked: [World Bank blog](https://blogs.worldbank.org/impactevaluations/teach-man-fish-and-maybe-hell-catch-something-show-him-where-fish-shop-located).
- **Immigrant-owner outreach.** Sacramento used multilingual liaisons who lived nearby, reported by the program ([Sacramento Asian Chamber](https://www.sacasiancc.org/wp-content/uploads/2023/08/2022-23-City-of-Sacramento-MBARK-ARPA-Program-Report_FINAL-10.pdf) [snippet]). Illinois advocates recommend trusted groups and ethnic media, older, advice not measured ([ICIRR](https://www.ilctr.org/wp-content/uploads/2017/09/SeedsofGrowth_FINAL_web.pdf) [snippet]). In Massachusetts only 23% of Asian-owned respondents used technical assistance in the past year ([WBJ](https://wbjournal.com/article/as-asian-owned-businesses-struggle-in-mass-report-recommends-dropping-citizenship) [snippet]).
- **Maryland channels.**
  - KAGRO, the Korean-American Grocers and Licensed Beverage Association of Maryland, founded 1995 to help merchants with vendors and city rules: [Baltimore Magazine](https://www.baltimoremagazine.com/section/community/corner-life/) [snippet].
  - LEDC offers lending and technical help with Spanish service in Baltimore and Wheaton, and has a Prince George's coach role: [Goldseker](https://goldsekerfoundation.org/grants/latino-economic-development-center/) [snippet]; [LEDC job listing](https://enableamerica.dejobs.org/silver-spring-md/small-business-coach-prince-georges-county/0665D852EFA949DE9F2688BA4C4DCC21/job) [snippet]. CDFI status not confirmed.
  - Maryland's DHCD gave about $1M in technical assistance grants to 38 projects for nonprofits and local governments, not businesses: [DHCD](https://news.maryland.gov/dhcd/2025/10/15/maryland-department-of-housing-and-community-development-announces-1-million-in-technical-assistance-grants/) [snippet].
- **Funding.**
  - NourishMD makes direct grants to food retailers, corner stores included, with a 20% healthy food rule. Round 2 closed Nov 2, 2026, and award sizes conflict ($150,000 cap against $100,000 to $500,000): [DHCD](https://dhcd.maryland.gov/Business/Pages/NourishMD-Grant-Program.aspx) [snippet]; [Grantedai](https://grantedai.com/grants/nourishmd-grant-program-maryland-community-business-compass-712b329a) [snippet]. Whether it covers POS is unknown.
  - The AI for Main Street Act passed the House and sits in Senate committee, and it creates no grants: [The Lobby News](https://www.thelobbynews.com/congress/bills/119/house-bill/5764) [snippet]; [Rework](https://resources.rework.com/es/news/ai-at-work/ai-for-main-street-act-small-business-owners-2026) [snippet]. One blog [title](https://adventuremedia.ai/blog/ai-for-main-street-act-senate-journey-how-the-2026-bill-became-law-and-what-comes-next) says it became law, and its own body text says it did not.

### Inferences
- Inference (mine): a client of a 45-minute setup session would not count as long-term in the SBDC impact method, which uses a 5-hour floor. So the SBDC's headline numbers do not support a short session, and no claim for one should imply they do.
- Inference (mine): the Nigeria result favors "someone does it with you" over a course, and supports assisted tool adoption more than a phone-run set of AI agents. But those firms got months of subsidized help at $2,000, not 45 minutes, so it does not validate a session that short.
- Inference (mine): the Ontario funnel shows money attached to the last step, the $2,500 grant. Assisted tool adoption with no grant has nothing to pull owners through, so expect a steeper drop.
- Inference (mine): Mexico and DMS both show interest is not take-up. In Mexico about half of interested firms declined even a 70% to 90% subsidy.
- Inference (mine): a 30-day answer given to the helper who set the tool up will skew yes. Use a record where one exists, such as call logs or POS data, and have someone else ask.
- Inference (mine): for corner stores, try the wholesaler and the trade association first. For Maryland restaurants, try peers, POS reps and the SBDC. No study ranks these for restaurants, so owner interviews should.

### Gaps
- No measured results surfaced for US student consulting programs with these trades. I also found no comparison of POS reps, peers and SCORE for restaurant owners, and no evaluation of ethnic trade groups as a channel.
- Not checked before the search budget ran out: state university extension programs for food retailers, including SNAP-Ed, and Maryland Department of Commerce programs on technology. I found no Commerce program for this in earlier searches.
- KAGRO's current activity and reach are unconfirmed. Call them.

## Willingness to pay

### Takeaway
No source measures what these owners would pay for AI tools or setup help. Prices paid suggest $29 a month could survive in either trade only with a visible return, and $99 a month is credible at a restaurant with a phone problem but not at a corner store. Supplier or payment money is what has paid for corner store tech so far.

### Cited Findings

| Product | Monthly price | Seller? |
|---|---|---|
| NRS POS software | $19.95 to $79.95 with NRS Pay, $29.95 to $109.95 without. Hardware $0 with own tablet, up to $1,799 for countertop, contract required | [NRS](https://www.nrsplus.com/pricing), vendor list price |
| Modisoft | $69 and $89 | [Modisoft](https://modisoft.com/home) [snippet], vendor |
| POS Nation | From $49 | [NerdWallet](https://www.nerdwallet.com/best/small-business/convenience-store-pos-systems) [snippet], third party |
| Maple AI phone | $150 or $85 billed yearly. Pro $350 or $220 | [Maple](https://maple.inc/blog/loman-ai-vs-maple-which-is-better-2026) [snippet], vendor |
| Loman, Hostie, Slang | From about $199, with conflicting tiers up to $600+ | [Reachify](https://reachify.io/blog/2026-pricing-guide-ai-phone-services-for-restaurants) [snippet]; [Loman on Hostie](https://loman.ai/blog/hostie-reviews-pricing-alternatives) [snippet], rivals' blogs |
| MarginEdge | $350 per location, plus onboarding, and extra for Toast users | [MarginEdge](https://www.marginedge.com/pricing), vendor |

- What NRS collects: in the quarter ended April 30, 2026, $25.8M merchant services, $4.5M SaaS fees and $5.7M advertising and data on 39,300 terminals, or $307 per terminal per month: [IDT 8-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926019382/ex_949775.htm). More than 30% of its retailers were on premium tiers: [IDT 10-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm). Filed by the seller, and the quarterly release is unaudited.
- Margins: median pre-tax 2.8% for full-service and 4.0% for limited-service restaurants in 2024, down from 4.0% and 6.0% in 2019, per the National Restaurant Association: [Bar & Restaurant](https://www.barandrestaurant.com/operations/nra-rising-costs-continue-squeeze-restaurant-profitability) [snippet]. Convenience store margins: 2% net in 2020 and 2021 per [BizBuySell](https://www.bizbuysell.com/learning-center/revenue-profit-benchmarks/convenience-stores) [snippet], a weak source. 60% to 63% of US convenience stores belong to very small operators: [NACS via CSP](https://www.cspdailynews.com/company-news/us-convenience-store-count-edges-down-slightly) [snippet].
- Sponsor models that exist: tobacco scan rebates; free hardware through Verifone distributors ([Verifone](https://go.verifone.com/en/us/commander-payments-g) [snippet], vendor); no retailer fee on NRS and Uber delivery ([Supermarket News](https://www.supermarketnews.com/foodservice-retail/nyc-bodegas-to-offer-delivery-under-new-uber-eats-partnership)); supplier-run ordering apps (BEES). US Foods offers free Menu IQ: [US Foods](https://ir.usfoods.com/newsroom/news/news-details/2026/US-Foods-Launches-Menu-IQ-AI-Powered-Tool-Giving-Restaurant-Operators-Real-Time-Visibility-Into-Menu-Profitability/default.aspx) [secondary, not reopened].
- Owners decline on price even with a large subsidy: most Mexican firms that turned down 70% to 90% off cited the fee: [IPA](https://poverty-action.org/boosting-firms-productivity-mexico-consulting-services). One San Francisco owner's objection was the cost of a refrigerator already bought: [PMC6200316](https://pmc.ncbi.nlm.nih.gov/articles/PMC6200316/).

### Inferences
- Inference (mine), from the IDT figures: dividing each line by three months and 39,300 terminals gives about $38 a month in explicit software, $219 in merchant services, likely gross of card network costs, and $48 from advertisers and data buyers. A corner store pays about $38 for its whole POS software. So $29 is close to the price of the entire register, and $99 is about 2.6 times it. This counts NRS customers only, who may spend more than the average store.
- Inference (mine): most stores staying below premium tiers suggests price sensitivity, even inside a captive base.
- Inference (mine): a restaurant with $600,000 in sales at the 2.8% median earns about $16,800 before tax. The sales figure is my assumption. $29 a month is about 2% of that, and $99 is about 7%. Owners already pay $150 to $350 for one job, so $99 for one measured job can survive. $99 for a general set of AI agents has no such anchor.
- Inference (mine): keeping setup help free to owners still looks right. Sponsorship by a POS or supplier conflicts with a neutral comparison, where vendors never pay for placement, so any such money must fund help for owners and not a tool's ranking.

### Gaps
- No price sensitivity study or stated-preference data for this group surfaced. Surveys of spending as a share of revenue are old or vendor blogs. Pricing for Slang and Hostie conflicts across pages, so check each vendor before quoting.
- NRS's $219 merchant line is not broken into net and gross on the pages I read.

## Stronger starting point: restaurant or corner store

### Takeaway
My view: a program testing either design should start with the restaurant, narrowly the independent counter-service or carryout shop that takes phone orders and already runs Square, Toast or Clover. Keep the corner store as a named second path through a partner, not as the first test. The evidence is thin on both, so I hold this with moderate confidence.

### Cited Findings

| Test | Restaurant | Corner store |
|---|---|---|
| Evidence that AI does a job there | Weak, mostly vendor data, but named owners exist ([Boston Globe](https://www.bostonglobe.com/2026/01/18/business/ai-restaurants-phone-pizza/)) | None found |
| Existing software to "turn on" | Toast IQ, Square AI and others ([NRN](https://www.nrn.com/restaurant-technology/toast-unveils-an-array-of-new-ai-agents-for-restaurants); [Square](https://squareup.com/us/en/ai)) [secondary, not reopened] | Many stores have no POS ([USDA](https://fns-prod.azureedge.us/research/snap/scanner-capability-assessment-snap-authorized-small-retailers); [POST](https://pmc.ncbi.nlm.nih.gov/articles/PMC8883529/)) |
| Measured failure risk | Rush-hour failure, stuck callers | Time cost and low interest: 1 of 4 quit a simple pilot, and 11 of 17 interviewed were uninterested in one program |
| Support required, by precedent | Vendor setup plus a person | About $24,000 per store and repeat visits in SF ([PMC6200316](https://pmc.ncbi.nlm.nih.gov/articles/PMC6200316/)), though for stock changes |
| Software price anchors | $150 to $350 per job | About $38 for all POS software, my calculation |
| Number of stores | 412,498 independents ([NRN](https://www.nrn.com/independent-restaurants/the-independent-restaurant-sector-shrunk-by-2-3-in-2025) [snippet]) | About 200,000 by a seller's estimate ([IDT 10-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm)) |
| SBA and Maryland programs | SBDC clients | SBDC retail clients, NourishMD, SNAP, Baltimore public health research |

### Inferences
- Inference (mine), for the restaurant: assisted tool adoption fits. The shop has existing systems to review, "turn on what you have" is real, a helper can do setup in a session, and call answering gives a 30-day number from a log, not a memory. Spanish-language phone demand gives a language-support check a concrete test, with vendor data as the only source so far.
- Inference (mine), the best case for the corner store: it is the sharper legacy-tech and equity story, since paper records and multilingual owners raise the access question most directly, and vendors underserve it. University-linked research and Maryland food access money give it local tie-ins, and funders or reviewers may remember it. But a good story with no tool that has shown results is exactly what anyone skeptical attacks. "Fresh food access" is also a different problem from "AI adoption."
- Inference (mine), what a corner store path could honestly be: a helper plus a wholesaler or trade group working on the basics first, such as a POS or a scan-data decision, invoice photos to a simple sheet, and SNAP or NourishMD paperwork. AI enters only as an aid to a person. This reads as a second-year step.
- Inference (mine), on a phone-run set of AI agents against assisted tool adoption for these two trades: the evidence favors a person doing setup and a small number of jobs. That supports assisted tool adoption over a set of agents that an owner runs alone. It does not prove assisted tool adoption works. Nothing shows 45 minutes is enough, and advisor capacity is unproven.

What would change my view:
- Owner interviews in Maryland show corner store owners name one chore they would pay to lose, and restaurant owners mostly say AI does not apply or already have it.
- A wholesaler, NRS or KAGRO agrees to make introductions and share a route to stores. Distribution is the hardest piece, so this outweighs much of the evidence above.
- NourishMD or a similar funder confirms it will pay for technology and support, which removes the price objection.
- At least five tools with real corner store use can pass a vetting on clear cost, connection to existing systems, data terms, who stays in charge, language support, ease of starting and proof in similar shops. If too few can, a corner store comparison would have nothing true to show.
- A restaurant pilot shows AI phones falling out of use by day 30, or review damage larger than the Boston Globe's single case suggests.
- Funders or reviewers weight food access and underserved owners well above technical fit.

### Gaps
- No head-to-head comparison of the two trades exists in anything I found, so this table is my own synthesis. Owner interviews should outrank it wherever they disagree.
- Sources for the restaurant case skew to chains and multi-unit groups, and sources for the corner store case skew to public health programs in big East Coast and Bay Area cities. Neither may describe small Maryland shops.
