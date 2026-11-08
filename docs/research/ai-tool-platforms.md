# Where small business owners find AI tools today

Checked Nov 7, 2026, US market. This note covers part (a) of the judges' "depth of research" criterion: the platforms an owner can use today to find, compare and adopt an AI tool. The trade research in `docs/research/` already covers part (b), what the owners need, and this note does not repeat it.

How to read the tags:

- No tag: I opened the page and read it.
- **[snippet]**: I saw the claim only in search result text. The page refused the fetch, or I did not open it.
- **[vendor]**: the source sells the product or platform it describes. Treat the claim as the company talking about itself.
- Repo paths point to the team's own research notes.

## Summary

Owners can turn to five kinds of help. In each one, either someone other than the owner pays, or the ranking measures something other than fit for one shop.

| Type | Examples | Who pays | How it ranks | What it never checks |
| --- | --- | --- | --- | --- |
| Vendor-funded software directories | G2, Capterra, GetApp, Software Advice | Vendors, per click, per lead or per referral | Review scores, review count, vendor size and web traffic, plus bids for sponsored slots | Whether the tool works with the owner's register or booking app. Fit for a shop of 1 to 4 people |
| AI tool directories | There's An AI For That, Futurepedia, Toolify, Product Hunt | Makers, through launch fees, featured slots and pay per click | Task match, saves, estimated traffic, launch-day votes | The owner's trade, software, languages or budget |
| Platform app marketplaces | Square, Toast, Clover, Shopify, ServiceTitan, Jobber | Developers and the platform | Category browsing, platform badges, paid ads on Shopify | Any tool outside that one platform |
| Public help | SBA, SBDCs, chambers of commerce | Taxpayers, plus Google, OpenAI and Perplexity | No ranking. Training and advice | A named shortlist an owner can compare |
| Matching services | G2.ai and Monty, Software Advice advisors, Vendasta resellers, AI consultants | Vendors, resellers or the owner | Not published | The evidence behind each pick |

## 1. Vendor-funded software directories

### What they do

These sites list business software by category, collect user reviews, and send buyers to vendors. On Jan 29, 2026, G2 announced it had agreed to buy Capterra, Software Advice and GetApp from Gartner. G2 says the combined marketplaces "will reach 200+ million annual software buyers" with "nearly 6 million verified customer reviews" [vendor] ([G2](https://company.g2.com/news/g2-acquires-capterra-software-advice-getapp)). A report on Gartner's 10-K says the sale closed Feb 5, 2026, for about $110 million [snippet] ([The Next Web](https://thenextweb.com/news/gartner-110m-sale-of-digital-markets-division-in-latest-sec-filing)). The four best-known directories now belong to one company.

### How they make money

- **G2.** Vendors pay per click on a "Go To Website" button on their G2 profile. "Fees are based on the number of clicks on any CTA," and the vendor sets a monthly budget and picks the category and region the clicks come from ([G2 PPC terms](https://legal.g2.com/g2-pay-per-click-service-description)). G2 also sells profile tiers and buyer intent data. Its FY26 pricing guide lists Buyer Intent in a G2 Data package [snippet] ([G2 pricing guide](https://sell.g2.com/hubfs/G2-External-Pricing-Guide-PDF-FY26.pdf)).
- **Capterra.** Vendors list for free and pay per click for sponsored placement. To run a campaign, a vendor upgrades to a Sponsored Profile and gets approval from a G2 Digital Markets representative [snippet] ([Capterra PPC terms](https://www.capterra.com/legal/ppc-service-description/)). The directory has a "Featured Partners" sort that orders listings by vendor bids, highest first, and bidding vendors get an orange "Visit Website" button [snippet] ([Capterra](https://www.capterra.com/ppc-software/)). An older Capterra post put the minimum bid at $2 a click, raised in $0.25 steps [snippet, dated] ([Capterra blog](https://blog.capterra.com/what-is-ppc/)).
- **Software Advice.** Advisors take free phone calls. The site says "When our advisors match you to a software provider, we may earn a referral fee," and vendors also pay for sponsored profiles [snippet] ([Software Advice](https://www.softwareadvice.com/)).
- **Where the reviews come from.** Vendors run review campaigns with gift cards from their Gartner Digital Markets account, and in some offers the vendor pays the full cost of the card [snippet] ([Gartner Digital Markets](https://digital-markets.gartner.com/Review-Collection-Service-Toolkit)). Capterra says only published reviews that pass its QA earn the card [snippet] ([Capterra incentive FAQ](https://review.capterra.com/Incentive-Program-FAQ)).

### How they rank

- **G2 Grid.** It has two axes. Satisfaction comes from review answers, weighted by volume, recency and how fully the reviewer filled in the form. Market Presence comes from review count, the vendor's employee count and revenue from ZoomInfo, LinkedIn and Crunchbase, Moz authority, branded search volume and Similarweb traffic. A product needs at least 10 reviews in a category to appear. G2's "Small Business" segment is "50 or fewer employees" ([G2 scoring methodology](https://documentation.g2.com/docs/research-scoring-methodologies)).
- **Capterra Shortlist.** It scores products on ratings and popularity "independent of any relationship that Capterra has with vendors" [snippet] ([Capterra methodology](https://www.capterra.com/resources/proprietary-data-research/)). Shortlist pages say a referral fee "has no influence on our research or methodology" [snippet] ([Capterra Shortlist](https://www.capterra.com/accounting-software/shortlist/)).
- **AI search on G2.** G2 launched Monty, an AI software advisor, in April 2023 [snippet] ([G2](https://company.g2.com/news/g2-monty-powered-by-openai)), then G2.ai for prompt-based search in June 2025 [snippet] ([Business Wire](https://www.businesswire.com/news/home/20250617138531/en)). G2's default profile chatbot "can recommend both your product and competitors." A vendor can pay to replace it on its own profile with a bot "whose goal is to sell your product, and your product only" ([G2 docs](https://documentation.g2.com/docs/monty-for-sales.md)).

### What an owner gets

A free, broad catalog with many reviews, category filters, and price pages. Tools are compared inside one software category, not across a job such as "return missed calls." The paid button sends the owner to the vendor's sales page. The 50-employee cutoff puts a 3-person corner store in the same bucket as a 50-person firm.

The team hit these limits during its own research. Capterra pages refused fetches, and directories disagreed on Tripleseat's price: $99 a month on Software Advice and $400 a month on HotelTechReport (`docs/research/corner-stores-and-restaurants-notes/tools_by_job.md`).

### The gap Anchored fills

- Market Presence rewards a vendor's headcount and web traffic. Neither says whether a tool works with a Clover register or a Toast account. Anchored's "Connects to your software" check reads the owner's own tools (`lib/domain/rating.ts`).
- A directory shows a star rating without saying where each fact came from. Anchored puts an evidence level on every check, including "Not checked yet" and "Needs pilot data."
- Nothing in Anchored's score is bought. The seven checks are its only inputs.

## 2. AI tool directories

### What they do and how big they are

- **There's An AI For That (TAAFT).** It calls itself "a human-reviewed index that maps 50,000+ AI tools to 11,000+ tasks and 5,000+ job roles." It reports 4.5M+ visits a month and 1.8M+ newsletter subscribers. It launched in Bucharest in December 2022 [vendor] ([TAAFT About](https://theresanaiforthat.com/about/), updated October 2026).
- **Toolify.** A third-party review dated Oct 7, 2026, read Toolify's homepage count as "30,959 AIs in 459 categories" and its own traffic claim as 5.1M+ monthly visits ([SaaSCity](https://saascity.io/directories/toolify)).
- **Futurepedia.** I found no site-wide total. Category pages show counts, such as 2,231 AI business tools [snippet] ([Futurepedia](https://www.futurepedia.io/ai-tools/business)).
- **Product Hunt.** It "highlights the best new products every day with a community-driven leaderboard" ([Product Hunt](https://www.producthunt.com/about)). It covers new tech products of every kind, and I found no measured share of AI launches.

### How tools get listed and ranked

- **TAAFT.** Staff review each submission, in 1 to 2 days on average, and label each tool by task and by pricing model, such as free, freemium or paid. "AI builders pay for launch listings (site, or site plus newsletter), sponsorships (site and newsletter), and pay-per-click" [vendor] ([TAAFT About](https://theresanaiforthat.com/about/)). The October 2026 review lists launch fees of $49 and $437, one time, and says the homepage Spotlight slot carries a rel="sponsored nofollow" link ([SaaSCity](https://saascity.io/directories/theresanaiforthat)).
- **Futurepedia.** A Verified Listing costs $497 one time, the $247 Basic tier is sold out, and every submission is "subject to editorial approval." The page says the tiers are not sponsored placements [snippet] ([Futurepedia submit page](https://www.futurepedia.io/submit-tool)).
- **Toolify.** A listing costs $99 per tool. Toolify sells pay-per-click ads, and per the review, "the more balance you hold, the higher your ads sit" ([SaaSCity](https://saascity.io/directories/toolify)). A competitor says Toolify ranks tools by estimated traffic from Similarweb [snippet] ([ToolJunction](https://www.tooljunction.io/vs/toolify)).
- **Product Hunt.** The team picks what reaches the homepage. Its help center says featuring is "not just about the most upvoted products" and "we can't guarantee that a product will be featured" ([Product Hunt help](https://help.producthunt.com/en/articles/484923-how-do-things-end-up-on-the-homepage)). It ranks launches within a single day.

### Do they consider fit for one business?

No. TAAFT gets closest: it matches by task, such as "summarize a meeting," and by job role. None of the four asks which register, booking tool or language a shop uses, or what it already pays for.

### What an owner gets

A free catalog that is huge and new, searchable by task, with filters for free tools. The owner has to know which task to search for. Then the results are sorted by saves, votes, traffic or paid slots.

### The gap Anchored fills

The problem is scale. An owner who searches 50,000 tools still has no way to see that the register they already pay for has an AI feature that does the job. Anchored starts from the business, names the jobs, and rates a small catalog built for each trade. The team's tool research counted about 45 restaurant products and 39 corner store products, and only 14 of the corner store products use AI for the job (`docs/research/corner-stores-and-restaurants-notes/tools_by_job.md`).

## 3. Platform app marketplaces

### What they offer

- **Square App Marketplace.** Square had "almost 1,000 partners" across the App Marketplace and its Square Specialists directory, in categories such as websites, booking, accounting and inventory, as of Feb 2026 ([PYMNTS](https://www.pymnts.com/smbs/2026/square-ecosystem-nears-1000-partners-fuel-seller-growth/)). Square's own assistant, Square AI, opened in public beta to all US sellers in the Dashboard in June 2025 [snippet, vendor] ([Square](https://squareup.com/us/en/press/square-ai-open-beta)). Its Managerbot agent reached open beta in April 2026 with no added fee [snippet] ([Shopifreaks](https://www.shopifreaks.com/square-opens-managerbot-ai-business-agent-to-broader-group-of-sellers-in-open-beta-inside-square-dashboard/)).
- **Toast.** "Toast partner integrations are included with the Restaurant Management suites," Essentials and Pro. Owners browse partners by category, and Toast says "dozens of partners work with Toast" [vendor] ([Toast support](https://support.toasttab.com/en/article/Set-Up-Toast-Partner-Integrations?lang=en_US)). Toast says its own assistant, Toast IQ, comes with Toast POS at no extra cost, and it reports 40,000 weekly active users in Q1 2026 [snippet, vendor] ([Toast](https://pos.toasttab.com/blog/on-the-line/toast-iq)).
- **Clover App Market.** Merchants browse by category and collection. A developer must choose at least one functional and one vertical category before submitting an app for approval ([Clover docs](https://docs.clover.com/docs/navigating-the-clover-app-market)). Developers keep a 70% royalty [snippet] ([Clover developers](https://www.clover.com/developers)).
- **Shopify App Store.** "Over 16,000 apps" ([Shopify App Store](https://apps.shopify.com/)). Paid ads carry an "Ad" label on the home, category and search pages. Only apps that pass Shopify's QA can advertise, and "You can't opt out of ads on the Shopify App Store." The Built for Shopify badge marks apps that meet Shopify's performance, design and integration bar, reviewed each year ([Shopify Help Center](https://help.shopify.com/en/manual/apps/finding-apps)).
- **ServiceTitan Marketplace.** 25 categories of "ServiceTitan-approved integration and services partners," with nine products labeled "Built By ServiceTitan," including an AI voice agent ([ServiceTitan Marketplace](https://marketplace.servicetitan.com/)). A blog counts about 140 certified integrations [snippet] ([PixieBrix](https://blog.pixiebrix.com/blog/best-servicetitan-integrations-in-2026-pixiebrix)). ServiceTitan launched its Atlas AI assistant in September 2025 [snippet] ([SiliconANGLE](https://siliconangle.com/2025/09/18/servicetitan-launches-atlas-ai-sidekick-automate-contractor-operations/)).
- **Jobber App Marketplace.** It passed 100 integrations on May 28, 2026, and "More than 100,000 businesses and 400,000 service pros use Jobber." Jobber AI answers calls and texts and drafts quotes [vendor] ([TechIntelPro](https://techintelpro.com/news/hr/workforce-management/jobber-reaches-100-app-integrations-milestone)).

### What an owner gets

Apps that are known to connect to the system the owner already runs, often billed through that system and sometimes checked by the platform. For an owner on one platform, this is the safest place to shop.

### The lock-in

- Each marketplace shows only apps that plug into its own platform. A Toast restaurant never sees Square's catalog.
- On Toast, the integration catalog comes with the paid Restaurant Management suites.
- Each platform sells its own products next to its partners' apps: "Made by Shopify," "Built By ServiceTitan," Toast IQ, Square AI. No marketplace compares its own AI with a rival's.
- An owner who switches registers loses the apps that worked with the old one.

### The gap Anchored fills

In the team's research, an owner's customer data sits in several systems at once: register customer and loyalty lists, reservation guestbooks, email tools and delivery portals (`docs/research/corner-stores-and-restaurants-notes/tools_and_ingestion.md`). Anchored reads across all of them. Like the marketplaces, it starts with what the owner already pays for, since Square AI and Toast IQ come with the register. Unlike them, it says when an outside tool or an Anchored agent fits the job better, and it counts tools already paid for as $0 on the monthly bill.

## 4. Public help

Program outcomes, the SBDC 5-hour impact floor and the Community Navigator pilot are in `docs/research/corner-stores-and-restaurants-notes/adoption_evidence.md`. This section covers only AI.

### SBA

- **Resource hub.** The OECD lists an SBA "AI for Small Businesses Resource Hub," started in 2024, that "aggregates federal & private sector guidance" ([OECD.AI](https://oecd.ai/en/dashboards/policy-initiatives/ai-for-small-businesses-resource-hub-sba)). On Nov 7, 2026, its sba.gov address opened SBA's general "Manage your business" guide, which names no AI products and offers no way to compare tools ([SBA](https://www.sba.gov/business-guide/manage-your-business/ai-small-business)).
- **Main Street AI Accelerator, June 2026.** SBA and Perplexity put $25 million toward $250 in Perplexity Computer credits for up to 100,000 small businesses that hold SBA 7(a) or 504 loans, plus "concierge onboarding." The program offers one vendor's product ([Nextgov](https://nextgov.com/acquisition/2026/06/sba-partners-perplexity-launch-25m-main-street-ai-accelerator/414198)).
- **AI for Main Street Act, H.R. 5764.** It adds an SBDC duty of "assisting small business concerns in evaluating artificial intelligence concerning operations," along with training and outreach, and says "No additional amounts are authorized" ([House text](https://www.govinfo.gov/content/pkg/BILLS-119hr5764eh/html/BILLS-119hr5764eh.htm)). The House passed it 395 to 14 on Jan 20, 2026 [snippet] ([House Clerk](https://clerk.house.gov/Votes/2026033)). The Senate referred it to committee on Jan 26 [snippet] ([BillTrack50](https://www.billtrack50.com/billdetail/1908748)). I found no Senate passage as of Nov 7.
- **Small Business AI Training Act, S. 3888.** Senators Cantwell and Moran reintroduced it in February 2026. It would have Commerce build AI training and deliver it through SBDCs, SCORE and Women's Business Centers [snippet] ([Senate Commerce](https://www.commerce.senate.gov/2026/2/cantwell-moran-reintroduce-bill-to-help-small-business-leverage-ai-tools)).
- **Office of Advocacy.** A September 2025 research spotlight, using Census data, put AI use at 8.8% of small businesses and 10.5% of large ones in August 2025 [snippet] ([SBA Advocacy](https://advocacy.sba.gov/2025/09/24/new-advocacy-article-highlights-small-businesses-closing-the-ai-adoption-gap/)).

### SBDCs and chambers

- **America's SBDC.** Its AI U program "has already trained more than 500 advisors network-wide." On Sep 30, 2026, it announced a pilot in which OpenAI Academy trains SBDC advisors to run workshops reaching "more than 1,000 small businesses," with "free access to ChatGPT Plus" for those who finish ([PR Newswire via Webull](https://www.webull.com/news/15667800403362816)). Google.org funded AI U with $10 million in 2024 [snippet] ([Innovation Iowa](https://innovationia.com/2024/12/05/americas-sbdcs-receive-10-million-to-connect-small-businesses-with-ai-training/)).
- **US Chamber of Commerce.** Google.org gave $5 million to the Chamber's foundation for Small Business B(AI)sics, announced Oct 8, 2025, to "equip 40,000 U.S. small businesses with foundational AI skills." The only tools the announcement names are Google's Gemini and NotebookLM ([Google](https://blog.google/company-news/outreach-and-initiatives/grow-with-google/small-businesses-grow-with-google-ai/)).

### What an owner gets

Free training, a human advisor, and sometimes free credits for one product.

### The gap Anchored fills

Public programs teach AI in general, or one sponsor's product. The House bill asks SBDCs to help owners "evaluate" AI and adds no money, and the programs reach thousands of businesses. None hands an owner a shortlist they can check. Anchored could be the tool an SBDC advisor opens in a session: it rates named tools on seven checks and shows the evidence behind each rating, so the advisor can verify it instead of vouching for one sponsor.

## 5. Services that already match small businesses to AI tools

- **G2.ai and Monty.** These are prompt-based recommenders on top of the G2 catalog, covered in section 1. A paying vendor can swap the neutral bot on its own profile for a sales bot.
- **Software Advice advisors.** These are free calls, and the vendor pays a referral fee when the advisor makes a match [snippet] ([Software Advice](https://www.softwareadvice.com/)).
- **Vendasta.** It sells through "Agencies, consultants, media companies, MSPs, and franchisors that serve SMBs," and reports 66,000+ channel partners and 8.2 million+ local businesses helped [vendor] ([Vendasta](https://www.vendasta.com/markdown/company.md)). The local agency picks from Vendasta's catalog and resells it under its own brand.
- **AI consultants and readiness quizzes.** Many offer a free assessment that leads into paid work, such as a free 30-minute session [snippet] ([Main & Machine](https://www.mainandmachine.com/book/)). One guide puts an assessment at anywhere from free to a few thousand dollars [snippet] ([Unio](https://unio.digital/blog/ai-consulting-small-business)).
- **Small AI tool finders.** MyPerfectAI recommends tools by task [snippet] ([Trend Hunter](https://www.trendhunter.com/trends/myperfectai)). StayModernAI claims to analyze an industry and match vendors [snippet] ([TopAI.tools](https://topai.tools/t/staymodernai)). I found no usage figures for either.
- **Perplexity through the SBA.** It onboards owners to one product, as covered in section 4.

I found no service that checks a tool against the owner's existing software, publishes the evidence behind each rating, and drafts the work itself where no tool fits.

## 6. Numbers for a slide

### The five strongest

1. **19.8% of US businesses use AI,** and AI use at firms with fewer than 20 employees showed no significant change from December 2025 to May 2026. Retail is at about 14%. Source: Census Business Trends and Outlook Survey, May 26, 2026 ([Census](https://www.census.gov/library/stories/2026/05/ai-use-businesses.html)).
2. **76% of small businesses use AI, but only 14% say it is fully embedded in their core operations, and 73% want more training and implementation help.** The barriers named include "difficulty choosing tools." Source: Goldman Sachs 10,000 Small Businesses Voices, March 2026 ([CPA Practice Advisor](https://www.cpapracticeadvisor.com/2026/03/17/small-businesses-embrace-ai-but-need-training-and-support-to-fully-harness-it/179886/)). The sample was 1,256 program participants, surveyed Jan 27 to Feb 4, 2026 [snippet] ([Goldman Sachs](https://www.goldmansachs.com/pressroom/press-releases/2026/small-businesses-embrace-ai-but-need-training-and-support-to-fully-harness-it)). Program participants likely use more tech than the average shop.
3. **50,000+ AI tools listed in the largest directory,** mapped to 11,000+ tasks and 5,000+ job roles, and to no shop's existing software. Source: There's An AI For That, October 2026 [vendor] ([TAAFT](https://theresanaiforthat.com/about/)).
4. **Peers are the top source of AI guidance, at 45%, and limited knowledge or training is the top barrier, at 23%.** Source: SBE Council Small Business Technology Use Survey, 517 owners of firms with 2 to 99 employees, Feb 17 to 23, 2026 ([SBE Council](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf), pages 3 and 6).
5. **One vendor-funded company now runs the four biggest software directories,** with "200+ million annual software buyers" and "nearly 6 million verified customer reviews." Source: G2's purchase of Capterra, Software Advice and GetApp, announced Jan 29, 2026 [vendor] ([G2](https://company.g2.com/news/g2-acquires-capterra-software-advice-getapp)).

### More, if the slide has room

- SBE Council: 82% of owners use at least one AI tool, and the median owner uses five ([SBE Council](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf), page 4). Owners already juggle several tools.
- US Chamber: 58% of small businesses use generative AI in 2025, up from 40% in 2024, in a survey run with Teneo. The page gives no sample size ([US Chamber](https://www.uschamber.com/technology/empowering-small-business-the-impact-of-technology-on-u-s-small-business)).
- San Francisco Fed: nearly 40% of small businesses used AI or planned to soon, in the 2024 Small Business Credit Survey. Some said they did not know how to put AI to work or which uses fit ([FRBSF](https://www.frbsf.org/?p=294902), Mar 23, 2026).
- SBA and Perplexity: $25 million for up to 100,000 businesses, all on one vendor's product ([Nextgov](https://nextgov.com/acquisition/2026/06/sba-partners-perplexity-launch-25m-main-street-ai-accelerator/414198)).
- Shopify lists over 16,000 apps ([Shopify](https://apps.shopify.com/)), and Square has almost 1,000 partners ([PYMNTS](https://www.pymnts.com/smbs/2026/square-ecosystem-nears-1000-partners-fuel-seller-growth/)).

Do not set the Census 19.8% beside the 58% to 82% survey figures as one trend. They ask different questions of different samples. Census is a federal survey, and the others are commissioned surveys or program participants. The repo makes the same caution in `corner_store_operations.md`.

## Where Anchored fits

- **It starts from the business, not the catalog.** Directories ask the owner to name a category or task. Anchored asks what the shop sells, how customers reach it and what software it runs, then names the jobs AI can take on.
- **It checks what the owner already pays for first.** Square and Toast say their assistants come with the register at no extra cost, and Jobber and ServiceTitan now build AI into their own apps. Anchored turns these features on before suggesting a purchase and counts them as $0 on the bill. Marketplaces push their own AI too, but never say when a rival's fits better.
- **It crosses platforms.** A marketplace sees one platform's apps. Anchored rates any tool against the owner's whole stack.
- **It shows its evidence.** Each of the seven checks carries an evidence level, from "Vendor page, read Nov 2026" to "Not checked yet." No directory or marketplace reviewed here labels where each fact came from.
- **Nothing in the score is bought.** Directories earn from clicks, leads, referrals and launch fees. Anchored's score has no paid input. If the team plans never to take placement money, state that on the site. It is the sharpest contrast with G2 and TAAFT.
- **It fills the gap with an agent.** Where no tool fits, an approve-first agent drafts the work as cards, and nothing goes out until the owner approves each one.
- **It works alongside public help.** An SBDC advisor or a chamber trainer could use Anchored as a shortlist they can verify, which supports the House bill's "evaluating" duty without tying them to one sponsor.

Limits to say out loud: G2 and Capterra have millions of reviews, and Anchored has a researched catalog from one session per trade. The "Proven in similar businesses" check often reads "Needs pilot data." A judge may ask how Anchored keeps its catalog current. The answer is the discovery agent: it searches the web for each workflow, keeps a tool only when its source is a page the search returned, and queues each find for a person to check before it gets a score.

## Not verified

- Toast's and Clover's partner counts. Toast's public pages and third-party trackers disagree, and Toast's own help page says "dozens."
- Whether G2 has published a closing announcement for the Capterra purchase. The closing date comes from a report on Gartner's 10-K [snippet].
- Capterra's current minimum bid and default sort order. capterra.com refused every fetch.
- The share of Product Hunt launches that are AI tools.
- Senate action on H.R. 5764 after Jan 26, 2026.
- Usage or funding for MyPerfectAI and StayModernAI.

## Sources

Opened:

- [G2 acquisition announcement](https://company.g2.com/news/g2-acquires-capterra-software-advice-getapp)
- [G2 scoring methodology](https://documentation.g2.com/docs/research-scoring-methodologies)
- [G2 pay-per-click terms](https://legal.g2.com/g2-pay-per-click-service-description)
- [G2 Monty for Sales docs](https://documentation.g2.com/docs/monty-for-sales.md)
- [There's An AI For That About page](https://theresanaiforthat.com/about/)
- [SaaSCity review of TAAFT](https://saascity.io/directories/theresanaiforthat) and [of Toolify](https://saascity.io/directories/toolify)
- [Product Hunt About](https://www.producthunt.com/about) and [homepage help article](https://help.producthunt.com/en/articles/484923-how-do-things-end-up-on-the-homepage)
- [PYMNTS on Square's partners](https://www.pymnts.com/smbs/2026/square-ecosystem-nears-1000-partners-fuel-seller-growth/)
- [Toast partner integrations help](https://support.toasttab.com/en/article/Set-Up-Toast-Partner-Integrations?lang=en_US)
- [Clover App Market docs](https://docs.clover.com/docs/navigating-the-clover-app-market)
- [Shopify App Store](https://apps.shopify.com/) and [Shopify Help Center on finding apps](https://help.shopify.com/en/manual/apps/finding-apps)
- [ServiceTitan Marketplace](https://marketplace.servicetitan.com/)
- [Jobber 100 integrations](https://techintelpro.com/news/hr/workforce-management/jobber-reaches-100-app-integrations-milestone)
- [Nextgov on SBA and Perplexity](https://nextgov.com/acquisition/2026/06/sba-partners-perplexity-launch-25m-main-street-ai-accelerator/414198)
- [OECD.AI on the SBA hub](https://oecd.ai/en/dashboards/policy-initiatives/ai-for-small-businesses-resource-hub-sba) and [the SBA address](https://www.sba.gov/business-guide/manage-your-business/ai-small-business)
- [H.R. 5764 House text](https://www.govinfo.gov/content/pkg/BILLS-119hr5764eh/html/BILLS-119hr5764eh.htm)
- [America's SBDC and OpenAI release](https://www.webull.com/news/15667800403362816) and [America's SBDC AI Day](https://americassbdc.org/aiday/)
- [Google on Small Business B(AI)sics](https://blog.google/company-news/outreach-and-initiatives/grow-with-google/small-businesses-grow-with-google-ai/)
- [Census BTOS story, May 2026](https://www.census.gov/library/stories/2026/05/ai-use-businesses.html)
- [Goldman Sachs survey via CPA Practice Advisor](https://www.cpapracticeadvisor.com/2026/03/17/small-businesses-embrace-ai-but-need-training-and-support-to-fully-harness-it/179886/)
- [SBE Council survey, March 2026](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf)
- [US Chamber technology report](https://www.uschamber.com/technology/empowering-small-business-the-impact-of-technology-on-u-s-small-business)
- [San Francisco Fed on small business AI](https://www.frbsf.org/?p=294902)
- [Vendasta company page](https://www.vendasta.com/markdown/company.md)

Seen only in search results [snippet]:

- [The Next Web on Gartner's $110M sale](https://thenextweb.com/news/gartner-110m-sale-of-digital-markets-division-in-latest-sec-filing)
- [G2 FY26 pricing guide](https://sell.g2.com/hubfs/G2-External-Pricing-Guide-PDF-FY26.pdf), [G2 Monty launch](https://company.g2.com/news/g2-monty-powered-by-openai), [G2.ai launch](https://www.businesswire.com/news/home/20250617138531/en)
- [Capterra PPC terms](https://www.capterra.com/legal/ppc-service-description/), [Capterra directory sort](https://www.capterra.com/ppc-software/), [Capterra PPC blog](https://blog.capterra.com/what-is-ppc/), [Capterra methodology](https://www.capterra.com/resources/proprietary-data-research/), [Capterra Shortlist](https://www.capterra.com/accounting-software/shortlist/), [Capterra incentive FAQ](https://review.capterra.com/Incentive-Program-FAQ)
- [Software Advice](https://www.softwareadvice.com/), [Gartner Digital Markets review toolkit](https://digital-markets.gartner.com/Review-Collection-Service-Toolkit)
- [Futurepedia submit page](https://www.futurepedia.io/submit-tool), [Futurepedia business tools](https://www.futurepedia.io/ai-tools/business), [ToolJunction on Toolify](https://www.tooljunction.io/vs/toolify)
- [Square AI open beta](https://squareup.com/us/en/press/square-ai-open-beta), [Shopifreaks on Managerbot](https://www.shopifreaks.com/square-opens-managerbot-ai-business-agent-to-broader-group-of-sellers-in-open-beta-inside-square-dashboard/), [Toast IQ](https://pos.toasttab.com/blog/on-the-line/toast-iq), [Clover developers](https://www.clover.com/developers), [PixieBrix on ServiceTitan](https://blog.pixiebrix.com/blog/best-servicetitan-integrations-in-2026-pixiebrix), [SiliconANGLE on Atlas](https://siliconangle.com/2025/09/18/servicetitan-launches-atlas-ai-sidekick-automate-contractor-operations/)
- [House Clerk roll call 33](https://clerk.house.gov/Votes/2026033), [BillTrack50 on H.R. 5764](https://www.billtrack50.com/billdetail/1908748), [Senate Commerce on S. 3888](https://www.commerce.senate.gov/2026/2/cantwell-moran-reintroduce-bill-to-help-small-business-leverage-ai-tools), [SBA Advocacy spotlight](https://advocacy.sba.gov/2025/09/24/new-advocacy-article-highlights-small-businesses-closing-the-ai-adoption-gap/), [Innovation Iowa on AI U funding](https://innovationia.com/2024/12/05/americas-sbdcs-receive-10-million-to-connect-small-businesses-with-ai-training/)
- [Goldman Sachs release](https://www.goldmansachs.com/pressroom/press-releases/2026/small-businesses-embrace-ai-but-need-training-and-support-to-fully-harness-it)
- [Main & Machine](https://www.mainandmachine.com/book/), [Unio](https://unio.digital/blog/ai-consulting-small-business), [Trend Hunter on MyPerfectAI](https://www.trendhunter.com/trends/myperfectai), [TopAI.tools on StayModernAI](https://topai.tools/t/staymodernai)
