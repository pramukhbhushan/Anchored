# AI for independent corner stores and restaurants

**Start these owners with existing tools, and add a drafted task the owner approves only where no tool fits and the work can wait for a tap.** Square and Toast already ship named AI agents to about 30% of small restaurants by one analyst estimate, many corner stores have no POS for an agent to read, and no independent evidence shows a set of AI agents working in a shop this size. The most promising new tasks start from a supplier's invoice or a federal stocking rule rather than a customer message, which also avoids most of the texting and phone law below. This is desk research checked on Nov 6, 2026. No owner has tested any of it.

**How to read the evidence.** Each citation says how the fact was checked. "Opened" means a researcher read the page. "Snippet" means a search summary only, so treat it as unconfirmed. "Vendor" means the publisher sells a related product. "Ran" means someone queried the data directly. "Reopened" means a second reader went back to the source on Nov 6. "Researcher inference" marks reasoning and not a sourced fact. Legal points are research and not legal advice. The `` folder holds the detail behind each section.

## Inbound lead follow-up is the wrong starting point

Fast lead follow-up is one proposed use of AI for small businesses. A lead lands, an approved text goes out, and the reply becomes an estimate. That fits a service business waiting on web leads. **A corner store has nothing to feed that loop.** Baltimore corner stores averaged 165 customers a day with 0.75 paid non-family workers, in a sample of 24 stores published in 2015 ([Mui et al.](https://www.mdpi.com/1660-4601/12/12/14965), opened). No source measures calls to these stores.

**Restaurants match it only through catering and events.** ezCater reports a $420 average order, from a report with more than 2,300 respondents including 669 operators, January 2025 ([ezCater release copy](https://www.silicon.co.uk/press-release/new-ezcater-data-highlights-workplace-food-as-a-key-growth-driver-for-restaurants), opened, vendor). ChowNow says $360, 9 to 10 times a takeout order ([ChowNow, May 2026](https://get.chownow.com/blog/restaurant-catering-guide-for-a-high-revenue-channel/), opened, competitor). Maple puts events and large parties at 7% of about 1.2M calls at 1,000+ locations, and 68% of calls land in the lunch and dinner windows ([Maple](https://maple.inc/blog/the-state-of-restaurant-phone-communication-insights-from-1-million-calls.md), opened, vendor; read as marketing). No non-vendor number exists for inquiries per month, close rate, reply time or catering's share of revenue. Researcher inference: an owner is free to approve a reply mostly outside the rush, and a live call cannot wait for a tap at all.

**For restaurants, a supplier price check looks stronger.** The median full-service restaurant kept 2.8% of sales before tax in 2024, and limited service kept 4.0%, in a survey of more than 900 owners with no chain split ([NRA State of the Restaurant Industry 2026](https://wtop.com/wp-content/uploads/2026/02/SOI-2026-Report-Watermarked.pdf), opened, reopened). Researcher inference: on a $1M model restaurant, one point of food cost is $10,000, or 36% of full-service profit. $1M is a modeling round number and not a measured median. Vendors describe unrecorded supplier price rises, but nobody publishes measured price creep at independents, so this is a bet to test with owners.

**For corner stores, outside pressure looks stronger than time savings.** USDA's final rule set a Nov 4, 2026 compliance date, with seven varieties in each of four staple categories, up from three ([Hogan Lovells](https://www.hlc.com/en/publications/usda-issues-final-rule-amending-snap-retailer-stocking-standards), opened, reopened). USDA estimated that 87,648 of 119,688 convenience stores, or 73%, lacked the varieties, in an analysis written for the proposed rule, so the final share may differ ([USDA impact analysis](https://content.govdelivery.com/attachments/WIGOV/2026/08/03/file_attachments/3734770/FNS-2025-0018-0002_content%20%282%29.pdf), opened, reopened). USDA's 4 hours or $200 of effort sits in tension with NACS, which says stores must evaluate nearly every product ([NACS](https://www.convenience.org/stay-current/news/2026/may/8/usda-releases-complex-overhaul-of-snap-stocking-requirements), opened, advocacy).

Convenience and fuel retailers asked USDA on Aug 31 to defer enforcement until six months after official guidance, and said nothing beyond the May notice had appeared ([retailer letter](https://nationalaglawcenter.org/wp-content/uploads/2026/09/retailers-snap-request-letter.pdf), opened, advocacy). This research found no sign that USDA agreed and no enforcement reports since Nov 4, and USDA's own page refused automated fetches, so check the status directly. The letter also describes a "complicated tiered variety structure," so a stocking check must come from the rule text and not from a flat count of seven. Researcher inference: every adoption wave in this segment had an outside push, such as a card customers carry, a rebate or a threat to SNAP. "Saves you time" has no track record here.

## Chores rank differently by dollars and by fit for an approval step

Ranks are judgment built on the tables in `restaurant_operations.md` and `corner_store_operations.md`. Restaurant dollar figures come from the $1M illustrative model, which is arithmetic and not measurement. The only hours figures come from vendors. "Fit" means how well the chore suits a drafted task that can wait for an owner's tap. "Build" means a new drafted task, where plain code carries out the action only after approval.

### Restaurant

| Chore | Value rank | Fit rank | Right answer | Basis |
|---|---|---|---|---|
| Supplier price rise, food cost | 1 | 2 | **Turn on** Square or Toast tools. **Buy** at higher volume. **Build** for everyone else | $10,000 per point on the model. MarginEdge at [$350 a location](https://www.marginedge.com/pricing) is $4,200 a year, 15% of $28,000 profit by arithmetic. MarketMan starts at [$249 with 50 scans](https://www.marketman.com/pricing). xtraCHEF price unconfirmed |
| Delivery commissions and disputes | 2 | 6 | **Do nothing** for most. **Buy** Orders.co at [$29](https://orders.co/restaurant-dispute-management-assistant) if on apps | Modeled $25,000 commission, $2,500 to $3,000 disputes. Software recovers disputes, and only direct orders recover commission |
| Shift gaps, schedule | 3 | 5 | **Turn on** Squaremates or Toast's agent, or the free tier of Homebase | 3.7 hours a week from [Harri](https://www.qsrmagazine.com/story/why-ai-scheduling-has-become-a-restaurant-necessity/), snippet, vendor. No official route reads an existing WhatsApp, iMessage or SMS group. Minors and overtime rules need code |
| Catering, event inquiry | 4, lumpy | 3 | **Buy** [Perfect Venue](https://www.perfectvenue.com/pricing) free plan, or ezCater at 15%. **Build** later | The one real lead loop. Frequency unmeasured |
| Missed calls | Unknown | 8 | **Buy** only if a call log shows volume: [Maple](https://www.maple.inc/pricing) $85 to $150 or [Certus](https://www.certus-ai.com/) $250. **Never build** | Nine products exist. A live call cannot wait for a tap. Miss rates are vendor data only |
| Review replies | 5 | 1 | **Turn on** Google's free reply box, or Toast's Reviews Agent for Grow customers | Fits an approval step best and is worth least. Marqii's approve-first tier costs [$180 on an annual contract](https://marqii.com/pricing) |
| Menu and price changes | Follows row 1 | 4 | **Do nothing** as a separate job | The owner acts on the price finding. POS writes add risk |
| Allergen sheet | Low now | 7 until recipes exist | **Build** an owner sign-off helper later | Recipes are the blocker. It never answers a customer |
| Tip and wage compliance | Tail risk | 9 | **Do nothing** in an agent. Use a payroll vendor and a lawyer | DOL-publicized cases of about $60,000 to $200,000, snippet. A wrong answer is the hazard |

### Corner store

| Chore | Value rank | Fit rank | Right answer | Basis |
|---|---|---|---|---|
| SNAP stocking check | 1 | 1 | **Build** | No product found. Code counts varieties against the published rule. It must say it is not a USDA determination |
| Tobacco rules, license and renewal calendar | 2 | 2 | **Build**, mostly as plain code | Maryland allows suspension of up to 90 days on a second violation ([ATCC](https://atcc.prod.maryland.gov/laws-regulations/law-and-policy-updates/tobacco-retail-modernization-act), opened). About $36,600 of gross profit for 90 days at NACS averages, which are chain-weighted, so scale down |
| Invoice check against last price | Unknown | 3 | **Buy** or use free first. **Build** a photo check for owner languages and promised deals | [Hisably](https://www.hisably.com/pricing) $30 plus $15 for AI capture, reopened. [Retail360](https://petrosoftinc.com/blog-news/retail-360-overview/) free. [CoreVue](https://apps.apple.com/app/corevue/id1610169477) free, snippet. No product page names an owner language, and none found checks an invoice against a promised deal |
| Tobacco scan rebates | One vendor illustration: [$178 a month net](https://goftx.com/blog/retail-scan-data/), snippet | 7 | **Buy** through the POS. An agent explains and never submits | Contractual and audited, with clawback risk. Researcher inference: a publicly funded or university-linked program should not route owners into tobacco rebates by default |
| Price book sync | Unknown | 4 | **Turn on** for NRS or Modisoft stores. **Do nothing** without a POS | Owners price from wholesaler cost. Hours are vendor claims |
| Next wholesaler run | Unknown | 5 | **Do nothing** for now, apart from a SNAP shopping list | Weak without sales data |
| Cameras, loss, age checks | Unknown | 8 | **Do nothing** | No list price. No measured theft reduction found. ID checks are a person's duty |
| Delivery apps | Unknown | 6 | **Do nothing** unless the POS already links | DoorDash lists [15%, 25% and 30%](https://merchants.doordash.com/en-us/products/pricing). One owner gave 20 to 30% margins on non-tobacco goods in 2020 |
| Reviews, leads, scheduling | Likely small | 9 | **Do nothing** | Walk-in trade with about one paid non-family worker in the Baltimore sample |

Researchers counted 39 store products with 14 carrying AI on the job, against 45 and 29 for restaurants, as a lower bound from one session (`tools_by_job.md`). "Do nothing" will often be the honest answer for a store.

## The two trades need different inputs, prices and channels

| Area | Restaurant | Corner store |
|---|---|---|
| Inputs | POS where it exists: Clover about 20%, Toast about 17%, Square 13%, Global Payments 11% below the top 250 ([Baird via Restaurant Dive, Jan 2026](https://www.restaurantdive.com/news/toast-clover-battle-for-small-eateries/809137/), opened, reopened, analyst estimate). Invoice photo for the rest | Plan for no POS. Old cash registers at 42.1% of 318 independents in seven states, none of them Maryland, found through Google ([CSI Works, Feb 2025](https://www.gorspa.org/wp-content/uploads/National-Survey-of-Independent-Consumer-Goods-Retailers-A-White-Paper.pdf), opened, reopened, vendor). 42% of small SNAP retailers lack scanning, undated, a different definition ([USDA](https://fns-prod.azureedge.us/node/10945), opened). Photos, CSV and voice with a helper |
| Useful work | Price watch first, catering later | Stocking check, license calendar, invoice check. No schedule or lead work |
| Measures of success, a proposal | Dollars of price rises caught and acted on, catering reply time where it applies, still in use after 30 days | Gaps closed, renewals on time, invoice dollars corrected, still in use after 30 days |
| Language | Spanish first, an inference. About 36% of owners are foreign-born, per an advocacy source ([Davis Vanguard](https://davisvanguard.org/2025/10/deportation-impacts-restaurant-industry/), snippet). Kitchen language is unmeasured | Korean first in Baltimore, then Spanish and Arabic, researcher inference. 7 of 20 Baltimore interviews in 2012 to 2013 ran in Korean ([owner interviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC5702771), opened), and the share has likely fallen. No source supports claims about Bengali or Amharic owners |
| Price anchor | $150 to $350 for one job. On an assumed $600,000 in sales at the 2.8% median, $99 a month is about 7% of profit | About $38 a month for all POS software on NRS, researcher inference from [IDT's 8-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926019382/ex_949775.htm), opened, reopened, seller filing. $99 fails. No willingness-to-pay study exists for either trade |
| Channel | POS reps, peers, SBDC. The Restaurant Association of Maryland is a real door, with a political tip credit campaign | Wholesaler and trade group. NRS sells through distributors and agents ([IDT 10-K](https://www.sec.gov/Archives/edgar/data/0001005731/000143774926031469/idt20260731_10k.htm), opened in one note, snippet in another). Baltimore researchers entered through a KAGRO letter ([Gittelsohn et al. 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC3043106), opened). KAGRO's current reach is unconfirmed |

Researcher inference: a 45-minute setup session would not count as a long-term client under the SBDC impact method, which uses a 5-hour floor, so SBDC headline outcomes do not support a session that short ([America's SBDC](https://americassbdc.org/wp-content/uploads/2022/11/SBDC-A-NATIONAL-2020-2021-impact-study1884.pdf), snippet). Store programs that worked sent people back repeatedly, such as Healthy Retail SF at about $24,000 per store before staff time, for stock changes and not software ([PMC6200316](https://pmc.ncbi.nlm.nih.gov/articles/PMC6200316/), opened). NourishMD pays corner stores directly, but round 2 closed Nov 2, award sizes conflict and POS coverage is unknown ([DHCD](https://dhcd.maryland.gov/Business/Pages/NourishMD-Grant-Program.aspx), snippet).

## POS vendors already sell the approve-first loop

Block says Managerbot is now Squaremates and generally available in the US, with no price in the letter ([Block Q3 2026 letter](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm), opened, reopened). Square says "Managerbot proposes an action, and sellers approve" ([Square](https://squareup.com/us/en/press/managerbot-open-beta), opened, reopened, vendor). Toast added SEO, Reviews and Offers agents and launched a Scheduling Agent in its Fall Release ([Toast 8-K](https://www.sec.gov/Archives/edgar/data/0001650164/000165016426000214/tost-20260930xexhibit991.htm), opened, reopened). Toast's approval model is not stated in what this research read, and its CEO describes paid marketing success managers reviewing the work ([Q2 2026 transcript, third party](https://transcripts.platformaeronaut.com/transcripts/TOST-2Q26-transcript), opened, vendor).

**Owning a feature is not using it.** About 40,000 of 171,000 Toast locations used Toast IQ weekly, about 23%, in Q1 2026 ([Toast Q1 call](https://fool.com/earnings/call-transcripts/2026/05/07/toast-tost-q1-2026-earnings-call-transcript), snippet, vendor), and 16% of Square's US sellers use monetized software, a measure of paid software and not AI ([Block](https://www.sec.gov/Archives/edgar/data/0001512673/000162828026069513/q32026shareholderletter.htm), reopened). Researcher inference: helping owners switch on what they already pay for has a real target, but a store owner with a cash register has nothing to switch on.

**Evidence on agents at this scale points the other way.** Presto's orders needed human help over 70% of the time on its in-house version, per the SEC ([SEC](https://www.sec.gov/enforcement-litigation/administrative-proceedings/33-11352-s), snippet). 1 of 4 Baltimore owners quit an 11-day tablet pilot at one tap per sale, citing a busy store and too few staff ([POST, 2019 data](https://pmc.ncbi.nlm.nih.gov/articles/PMC8883529/), opened, reopened).

## Design findings for any approve-first system

- **Keep the action in plain code.** Plain code that will not act without a person's tap is the best-supported idea here. Add a hard list, also in code, of what it refuses.
- **Limit the decisions.** A researcher estimate is 3 to 5 decisions a day, batched outside the rush, with Skip on timeout. No study counts owner approvals. The nearest evidence is 112 clinicians, where each extra advisory per encounter cut acceptance 30% ([Ancker 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5387195/), opened). Scheduled repeat follow-ups hurt acceptance most in that study and add legal exposure with customers.
- **Distrust tap-based measures.** Researcher inference: hours saved counted from approvals and the share of actions approved from a phone both measure tapping, so a shop could score high while saving nothing. A high approval rate is a warning sign.
- **Let code rank.** A model extracts and explains, and code does the arithmetic, comparison and rule counting. A failed check stops the task and asks the owner.
- **Type and tap first.** No measured voice accuracy exists in a kitchen or store. Use voice with a helper present.
- **Check what stuck with someone other than the installer.** Researcher inference: a yes given to the person who did the setup will skew positive. Use a record where one exists.
- **Describe software as software.** Calling agents "hired people" misdescribes what the owner bought.

## What connects without partner approval

| Input | Access | Status |
|---|---|---|
| Invoice phone photo | Any vision model | No approval needed. No accuracy evidence found for handwritten or thermal distributor invoices. Vendors report 85 to 92% for phone photos and 60 to 80% for handwriting, with no method for the latter ([Invoox](https://invoox.io/en/blog/ai-vision-invoice-extraction-accuracy/), opened, vendor). Test 10 real invoices |
| CSV export | Owner uploads | The only path found for NRS, Modisoft and stores with no POS. No public API found for either, which does not prove none exists |
| Square Sandbox | Self-serve | Free with webhooks, no seeded data, and no Square for Restaurants, so it models retail or counter service |
| Twilio missed-call event | Paid account | The trial guide lists "Call Twilio numbers" among uses needing a verified number |
| Toast | Standard API read-only, no sandbox, "must be an active employee" of the location | Partner route has no published timeline |
| Google Business Profile | Profile verified for 60+ days, quota 0 until approved | Review time not stated |
| DoorDash, Uber Eats, Grubhub | Partner-gated | DoorDash reviews applications quarterly |

**Twilio trial accounts cannot send a drafted text.** They send only to up to 5 verified numbers and "must use Twilio-provided templates," since "Custom message bodies" are not available, and registration needs a paid account ([Twilio trial guide](https://www.twilio.com/docs/messaging/guides/how-to-use-your-free-trial-account), opened verbatim, reopened). Twilio says it "blocks messages to U.S. numbers" from a number with no approved campaign, though its overview mentions only extra fees ([error 30034](https://www.twilio.com/docs/api/errors/30034), [overview](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc), opened). Review time is unconfirmed. Expect fees near $19.50 plus $2 a month as a sole proprietor ([Twilio fees](https://support.twilio.com/hc/en-us/articles/1260803965530), snippet). A vision call costs about $1.30 per 1,000 images at Haiku 4.5 rates for a 1000x1000 image ([Claude docs](https://platform.claude.com/docs/en/build-with-claude/vision), opened verbatim).

## Twelve things to keep out of any agent

An approval tap does not cure most of these. "Unsettled" means this research found no controlling answer. The FCC's Oct. 26, 2026 amendment to 47 CFR 64.1200 was not read, so check it first.

| Keep out | Rule | Status |
|---|---|---|
| Answers to allergen questions | A tap turns a guess into the restaurant's statement. Send the owner an alert with no draft. Food Code written notice applies [where adopted](https://www.fda.gov/food/retail-food-industryregulatory-assistance-training/addition-2022-food-code-sesame-added-major-food-allergen) | Maryland's adoption unconfirmed. No case found, which is not evidence of safety |
| Recording or transcribing calls without all-party consent | [Md. Cts. & Jud. Proc. 10-402](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=10-402): felony, up to 5 years or $10,000, reopened | Statute clear. AI transcription as interception unsettled. [ConverseNow](https://www.privacyworld.blog/2025/12/extra-large-pii-zza-courts-allows-california-privacy-class-action-to-proceed-for-use-of-ai-phone-call-assistant/) is a California pleading-stage ruling |
| Outbound AI voice calls without consent | [FCC 24-17](https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf) | Settled for outbound. Inbound answering not clearly covered |
| Customer texts with no consent record, STOP language or quiet hours | [Twilio policy](https://www.twilio.com/en-us/legal/messaging-policy) applies regardless. [Md. Com. Law 14-4502](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4502) bars solicitation from 8 p.m. to 8 a.m. | The tap supplies no consent. Maryland's "automated system" and missed-call text-back are unsettled |
| Tobacco, vape and nicotine content in customer texts | Barred "regardless of local legality," and a rejected campaign is "not eligible for resubmission" ([Twilio 30958](https://www.twilio.com/docs/api/errors/30958), reopened) | Carrier rule. Sources conflict on alcohol, so block it, and block lottery until Twilio confirms |
| Age checks, or anything implying one | Face-to-face duty under [21 CFR 1140.14](https://www.law.cornell.edu/cfr/text/21/1140.14) | Settled |
| EBT-based segments, discounts or surcharges | "No retail food store may single out coupon users" ([7 CFR 278.2](https://www.law.cornell.edu/cfr/text/7/278.2)) | Opt-in promotions that happen to reach EBT users are unanswered |
| Lottery prices, and pricing from personal data | [Md. State Gov't 9-124](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsg&section=9-124) fixes lottery prices. [HB 895, law firm summary](https://www.troutmanprivacy.com/2026/04/maryland-enacts-protection-from-predatory-pricing-act/) reaches stores of 15,000 square feet and up, so corner stores fall outside | Keep the rule anyway. Below-cost and cigarette pricing rules were not confirmed |
| Tip math, tip pools and unchecked schedules | [DOL Fact Sheet 15](https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa) and [Md. Lab. & Empl. 3-211](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=3-211). Code hard-fails a schedule with no birth date for a minor | Maryland's $400,000 small food business exemption means a lawyer checks any wage statement to an owner |
| Writing reviews, tying rewards to ratings, accusing reviewers | [FTC rule](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers). Honest owner-approved replies are allowed | The Rytr order was set aside, and the rule on businesses stands. State AI disclosure laws unverified, so disclose by default |
| Google content outside its limits | Places reviews stay away from models and read-aloud, since [Maps Platform terms](https://cloud.google.com/maps-platform/terms) name text-to-speech as a barred use. [Business Profile](https://developers.google.com/my-business/content/policies) replies need "prior specific and express consent," with storage capped at 30 days, reopened | Researcher inference, unsettled: whether sending a review to a model is "use outside" the project. Get it in writing |
| Reading staff chats, using POS data to train, pooling rivals' prices | [WhatsApp terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform) bar training on platform data and leave "primary" AI to Meta's discretion. [Square terms](https://squareup.com/us/en/legal/general/developers) bar training. Pooling competitors' prices carries antitrust risk, a research judgment | Staff monitoring law was not researched |

## What would change the conclusion

- Interviews showing owners would not photograph invoices, or that price rises are not a felt loss, would kill the price check.
- A tool that handles invoice checks at a price and in a language a store can use would make a new task unnecessary. Hisably is the nearest.
- A Squaremates procurement agent shipping broadly would remove the case for a new task in Square shops. Block names these agents as planned, with no date.
- A wholesaler, NRS or KAGRO offering a route to stores would justify leading with the store. A restaurant-first start is one researcher's view, held at moderate confidence.

## A validation order

| Order | Step | Done when |
|---|---|---|
| 1 | Interview at least three owners, one a store, and show them an invoice price check. Read the BUD trial: 38 East Baltimore corner stores, randomized 19 and 19 ([protocol](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9329906/), search result, no outcomes found) | Owner counts and a written answer on a route to stores |
| 2 | Run 10 real invoices through extraction, including a handwritten and a faded thermal one | Field accuracy measured |
| 3 | Get written answers from Toast and Google on the gray areas above, and a law clinic review | Each gate has a date or a no |
| 4 | Pilot the invoice check at 5 to 10 shops | Field accuracy, edit rate, skip rate and dollars acted on are published |
| 5 | Add catering and missed-call events only under a consent record | First customer text sent under that record |
| 6 | Proposed stop rule: if under half of pilot shops still use the check after 30 days, cut it | Published results |

## Where sources conflict

| Conflict | What the sources say | Treatment |
|---|---|---|
| Unprofitable operators | NRA's opening letter says 45%. Its body says 42% in at least three places, and NRN repeats 42% | Both confirmed in the PDF text. Quote 42% with a note. "Not profitable" is the wording, and "lost money" is not |
| Square's agent name | Older sources say Managerbot, free in open beta. Block says Squaremates, generally available, no price | Older sources are stale |
| Toast IQ Grow price | $499 ([Pulse 2](https://pulse2.com/toast-iq-grow/?noamp=mobile), third party) against starting at $699 ([NRN, Oct 7, 2026](https://www.nrn.com/restaurant-technology/toast-unveils-an-array-of-new-ai-agents-for-restaurants), reopened) | Unresolved, since Toast's own price page was blocked |
| Toast phones | The Spring release shows no standalone agent. NRN lists an Answering Agent in early access | NRN is newer. Treat it as early access, no price |
| AI use at restaurants | NRA 26%, Toast about 86% experimenting ([Toast via Stacker](https://keyt.com/stacker-business-economy/2026/09/26/survey-how-us-restaurants-are-handling-inflation-labor-ai-and-revenue-growth/), 676 operators, April 2026, vendor) | Different questions, and neither shows owners running agents |
| Understaffing | NRA 22%, Q4 2025, reopened. James Beard 49% of independents, more than 380 respondents ([JBF](https://www.jamesbeard.org/impact/research-and-reports/2026-independent-restaurant-industry-report), reopened) | Different questions. The independent-only figure runs higher |
| SNAP convenience store count | USDA 119,688 in June 2025. The live data layer shows 108,293 ([ran](https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0)) | Cause unknown. Do not call it exits |
| Shelf photos | One note favors them. Another calls shelf vision a poor fit until accuracy is tested | Tap-to-confirm first |
| Allergen law in Maryland | One note says no law requires a chart today. Another says Food Code adoption is unconfirmed | Treat it as unconfirmed |
| Missed-call rates | Full service is described as missing the fewest calls, yet the same vendor source puts pizza lower at 6.9% against 9.0%, and the 9.0% is snippet only | Vendor data, and do not rank formats on it |

## Not found

- No independent test of a set of AI agents or AI chores in any shop this size.
- No time diary or owner hours data for either trade, only vendor figures on managers.
- No independent before-and-after study of AI phones, invoice capture or AI scheduling at independents. The Boston Globe's count of 20 of 1,700+ reviews mentioning AI or robot phones is the only independent look at a named owner, with no named counter ([Boston Globe](https://www.bostonglobe.com/2026/01/18/business/ai-restaurants-phone-pizza/), opened, reopened).
- No revenue or margin for an independent store with no fuel, since NACS averages describe a store with about 20 employees.
- No study of approval rates among owners, no store price sensitivity data, no measured catering frequency and no AI churn figure.
- No BUD trial outcomes. Reddit owner threads could not be reached.
- No Maryland independent restaurant count exists, and the researcher's 7,300 to 8,400 is an inference.
