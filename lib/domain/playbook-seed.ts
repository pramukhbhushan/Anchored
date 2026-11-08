import type { PlaybookNiche, PostFormat, PostHashtag, PostHook, PostPlatform, PostPlaybook } from "@/lib/domain/playbook";

// =============================================================================
// Module Overview
// =============================================================================
// The starting post playbook, written from formats that reliably get reach for
// small local businesses on Instagram, Facebook and LinkedIn. It seeds the
// `post_formats`, `post_hooks` and `post_hashtags` tables through
// `scripts/playbook-sql.ts`, and the in-memory store serves it as is. Edit the
// rows here, regenerate the SQL, and add it as a new migration.

const IG: PostPlatform = "instagram";
const FB: PostPlatform = "facebook";
const LI: PostPlatform = "linkedin";
const ALL: readonly PostPlatform[] = [IG, FB, LI];
const SOCIAL: readonly PostPlatform[] = [IG, FB];

// =============================================================================
// Formats
// =============================================================================

const FORMATS: readonly PostFormat[] = [
  // ---- Every business --------------------------------------------------------
  {
    id: "behind-the-scenes",
    name: "Behind the scenes",
    niches: ["any"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 10,
    why: "People trust a business more once they see the work nobody usually sees.",
    structure: ["The finished result or the most striking shot, with the hook", "The work in progress", "A detail that shows care or skill", "Who did it, and an invitation to ask questions or book"],
    photoIdeas: ["The work in progress, hands in frame", "Tools or setup laid out", "The finished result"],
    cues: ["behind the scenes", "process", "prep", "setup", "working on", "today we"],
  },
  {
    id: "meet-the-team",
    name: "Meet the team",
    niches: ["any"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 4,
    why: "Faces get more engagement than products, and customers like knowing who will show up.",
    structure: ["A natural photo of the person, with the hook", "What they do here, in one line", "One real fact the owner shared about them", "A welcome line"],
    photoIdeas: ["The person at work, looking natural", "The person with their favorite tool or spot"],
    cues: ["meet", "team", "staff", "employee", "crew", "welcome", "new hire", "joined"],
  },
  {
    id: "quick-tip",
    name: "Quick tip",
    niches: ["any"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 6,
    why: "Useful posts get saved and shared, which tells the platform to show them to more people.",
    structure: ["The problem the tip solves, as the hook", "The tip in one or two steps, one per slide", "Why it matters", "When to call the business instead"],
    photoIdeas: ["The thing the tip is about, close up", "Each step being done", "The result when it is done right"],
    cues: ["tip", "how to", "advice", "should", "remember to", "don't forget", "save"],
  },
  {
    id: "faq-answered",
    name: "Question we get a lot",
    niches: ["any"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 5,
    why: "Answering the question customers already ask shows expertise and saves the owner phone time.",
    structure: ["The question, word for word, as the hook", "The short answer", "The reason behind it", "An invitation to send more questions"],
    photoIdeas: ["The thing people ask about", "The owner or staff explaining it"],
    cues: ["question", "ask", "asked", "faq", "people wonder", "often"],
  },
  {
    id: "local-love",
    name: "Local love",
    niches: ["any"],
    platforms: SOCIAL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 6,
    why: "Neighborhood pride gets shared in local groups, and local reach is what brings customers in.",
    structure: ["A recognizable local spot or event, with the hook", "How the business is part of it", "A thank you to the neighborhood", "Where to find the business"],
    photoIdeas: ["The business at a local event or landmark", "The storefront or truck in the neighborhood"],
    cues: ["local", "community", "neighborhood", "neighbors", "event", "festival", "fair", "market"],
  },
  {
    id: "milestone",
    name: "Milestone",
    niches: ["any"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 8,
    why: "Celebrations invite congratulations, and those comments spread the post to friends of friends.",
    structure: ["The milestone the owner named, as the hook", "Where the business started", "A thank you to customers and team", "What comes next"],
    photoIdeas: ["An early photo, if the owner has one", "The team today", "The storefront or work today"],
    cues: ["anniversary", "years", "milestone", "celebrate", "opened", "birthday", "first"],
  },
  {
    id: "lesson-learned",
    name: "Lesson learned",
    niches: ["any"],
    platforms: [LI],
    media: "either",
    minPhotos: 1,
    maxPhotos: 4,
    why: "On LinkedIn, an honest story with one clear lesson gets more comments than any announcement.",
    structure: ["The moment, as the hook", "What happened, in three or four short lines", "The lesson", "A question that invites others to share theirs"],
    photoIdeas: ["The job or moment the story is about", "The owner at work"],
    cues: ["learned", "lesson", "mistake", "realized", "taught", "challenge", "hard"],
  },
  {
    id: "community-impact",
    name: "Community impact",
    niches: ["any"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 10,
    why: "Posts about real people being helped get shared far beyond the business's followers.",
    structure: ["The most human photo, with the hook", "What happened and who took part", "The difference it made, only as the owner described it", "How others can help or join"],
    photoIdeas: ["Volunteers or staff in action", "The group together", "The finished project or event"],
    cues: ["volunteer", "donate", "donation", "charity", "fundraiser", "students", "kids", "class", "workshop", "impact", "nonprofit", "school"],
  },
  {
    id: "hiring",
    name: "We're hiring",
    niches: ["any"],
    platforms: ALL,
    media: "single",
    minPhotos: 1,
    maxPhotos: 1,
    why: "A hiring post with a real team photo gets shared by employees and customers who know someone.",
    structure: ["The role, as the hook", "What a day looks like", "Who would fit", "How to apply"],
    photoIdeas: ["The team at work, smiling"],
    cues: ["hiring", "job", "position", "apply", "join our team", "looking for"],
  },

  // ---- Home services ---------------------------------------------------------
  {
    id: "before-after",
    name: "Before and after",
    niches: ["home", "store"],
    platforms: ALL,
    media: "carousel",
    minPhotos: 2,
    maxPhotos: 8,
    why: "The most shared format in the trades: the swipe from before to after does the selling.",
    structure: ["The before shot, with the hook", "The work in progress", "The after shot from the same angle", "What was done and how to book"],
    photoIdeas: ["Before, from a wide angle", "During, with the work visible", "After, from the same angle as the before"],
    cues: ["before", "after", "replaced", "replacement", "renovation", "remodel", "transform", "upgrade", "makeover", "reset"],
  },
  {
    id: "signs-you-need",
    name: "Signs you need it",
    niches: ["home"],
    platforms: ALL,
    media: "carousel",
    minPhotos: 3,
    maxPhotos: 6,
    why: "Homeowners save checklists, and a checklist turns a future emergency into a booking.",
    structure: ["The checklist title, as the hook", "One sign per slide, each with a photo", "What happens if it is ignored", "How to book a check"],
    photoIdeas: ["Each warning sign close up, one per photo", "The technician checking it"],
    cues: ["signs", "warning", "noise", "leak", "broken", "failing", "old", "check"],
  },
  {
    id: "on-the-job",
    name: "On the job today",
    niches: ["home"],
    platforms: SOCIAL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 6,
    why: "A quick look at today's job shows the business is busy, local and trusted.",
    structure: ["The most interesting shot of the job, with the hook", "What the job was, in one line", "One detail that shows skill", "How to book"],
    photoIdeas: ["The truck or van at the job", "The work close up", "The finished result"],
    cues: ["today", "job", "install", "installed", "repair", "repaired", "service", "fixed", "tune-up", "maintenance"],
  },
  {
    id: "seasonal-reminder",
    name: "Seasonal reminder",
    niches: ["home", "store", "restaurant"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 5,
    why: "Timely posts ride what people are already thinking about this week.",
    structure: ["The season and the reason to act now, as the hook", "What to do or what is new", "Why now", "How to book or visit"],
    photoIdeas: ["The seasonal work or product", "A seasonal detail like a thermostat, decorations or menu board"],
    cues: ["winter", "summer", "spring", "fall", "autumn", "season", "holiday", "cold", "heat", "christmas", "thanksgiving"],
  },
  {
    id: "tools-of-the-trade",
    name: "Tools of the trade",
    niches: ["home"],
    platforms: [IG, LI],
    media: "carousel",
    minPhotos: 3,
    maxPhotos: 8,
    why: "Showing the gear signals professionalism and gets curious comments from other pros.",
    structure: ["The van or toolkit, with the hook", "One tool per slide and what it does", "Why it matters for the customer", "How to book"],
    photoIdeas: ["The van or toolbox open", "Each key tool, one per photo"],
    cues: ["tools", "van", "truck", "equipment", "gear", "kit"],
  },

  // ---- Restaurants -----------------------------------------------------------
  {
    id: "dish-spotlight",
    name: "Dish spotlight",
    niches: ["restaurant"],
    platforms: SOCIAL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 5,
    why: "A close, well-lit plate is what stops the scroll on food accounts.",
    structure: ["The plate close up, with the hook", "What is in it", "What makes it special, only as the owner described it", "When to come try it"],
    photoIdeas: ["The dish close up in daylight", "A bite or pull shot", "The dish on the table with the room behind it"],
    cues: ["dish", "plate", "special", "menu", "new item", "flavor", "taste", "dessert", "drink"],
  },
  {
    id: "how-its-made",
    name: "How it's made",
    niches: ["restaurant", "store"],
    platforms: ALL,
    media: "carousel",
    minPhotos: 3,
    maxPhotos: 10,
    why: "Process shots in order hold attention to the last slide, which the platforms reward.",
    structure: ["The finished product, with the hook", "Each step in order, one per slide", "The finished product again", "Where to get it"],
    photoIdeas: ["Raw ingredients or materials", "Each step being made", "The finished product"],
    cues: ["made", "making", "scratch", "homemade", "fresh", "bake", "baked", "recipe", "handmade"],
  },
  {
    id: "this-or-that",
    name: "This or that",
    niches: ["restaurant", "store"],
    platforms: SOCIAL,
    media: "carousel",
    minPhotos: 2,
    maxPhotos: 2,
    why: "A two-option question gets quick comments, and comments push the post to more people.",
    structure: ["Option one, with the question as the hook", "Option two", "Ask people to vote in the comments"],
    photoIdeas: ["Option one on its own", "Option two from the same angle"],
    cues: ["vote", "which one", "pick one", "choose", "versus", "vs"],
  },

  // ---- Stores ----------------------------------------------------------------
  {
    id: "new-arrival",
    name: "New arrival",
    niches: ["store"],
    platforms: SOCIAL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 8,
    why: "New stock gives regulars a reason to come back this week.",
    structure: ["The new item, with the hook", "What it is", "Who it is for", "Where in the store to find it"],
    photoIdeas: ["The new item on the shelf", "The item close up", "The item in someone's hand"],
    cues: ["new", "arrived", "arrival", "in stock", "just in", "restock", "back in"],
  },
  {
    id: "staff-pick",
    name: "Staff pick",
    niches: ["store", "restaurant"],
    platforms: SOCIAL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 4,
    why: "A personal recommendation from a real person sells better than an ad.",
    structure: ["The person holding their pick, with the hook", "What it is", "Why they love it, in their words", "Where to find it"],
    photoIdeas: ["The staff member holding the item", "The item close up"],
    cues: ["pick", "favorite", "recommend", "loves", "go-to"],
  },

  // ---- Coaches and services --------------------------------------------------
  {
    id: "framework",
    name: "My method in steps",
    niches: ["coach"],
    platforms: [IG, LI],
    media: "carousel",
    minPhotos: 3,
    maxPhotos: 8,
    why: "Step-by-step carousels are the most saved format on LinkedIn and Instagram for experts.",
    structure: ["The result the method gets, as the hook", "One step per slide", "A common mistake to avoid", "An invitation to book a call"],
    photoIdeas: ["The coach at work or speaking", "A whiteboard or notes for each step", "A session in progress, with permission"],
    cues: ["method", "steps", "framework", "process", "system", "approach"],
  },
  {
    id: "client-win",
    name: "Client win",
    niches: ["coach", "home"],
    platforms: ALL,
    media: "either",
    minPhotos: 1,
    maxPhotos: 4,
    why: "A real result told as a story is the most convincing proof a service business has.",
    structure: ["The result, as the hook", "Where the client started, without naming them unless allowed", "What changed", "An invitation for others in the same spot"],
    photoIdeas: ["The work or session, with permission", "A thank-you note with the name covered"],
    cues: ["client", "result", "win", "success", "progress", "thank you note"],
  },
  {
    id: "myth-vs-fact",
    name: "Myth vs. fact",
    niches: ["coach", "home"],
    platforms: ALL,
    media: "carousel",
    minPhotos: 2,
    maxPhotos: 6,
    why: "Correcting a common belief sparks comments and positions the owner as the expert.",
    structure: ["The myth, as the hook", "The fact", "Why the myth costs people", "An invitation to ask more"],
    photoIdeas: ["The thing the myth is about", "The owner explaining it"],
    cues: ["myth", "fact", "actually", "truth", "misconception", "believe"],
  },
];

// =============================================================================
// Hooks
// =============================================================================

/** Build hook rows from `[id, text, formats]` tuples that share niches and platforms. */
function hooks(niches: readonly PlaybookNiche[], platforms: readonly PostPlatform[], rows: readonly (readonly [string, string, readonly string[]])[]): PostHook[] {
  return rows.map(([id, text, formats]) => ({ id, text, niches, platforms, formats }));
}

const HOOKS: readonly PostHook[] = [
  ...hooks(["any"], ALL, [
    ["any-nobody-sees", "The part of {the work} nobody gets to see.", ["behind-the-scenes"]],
    ["any-what-it-takes", "What it takes to {do the work}, in {photo count} photos.", ["behind-the-scenes", "how-its-made"]],
    ["any-meet", "Meet {first name}, the person behind {what they do}.", ["meet-the-team"]],
    ["any-quick-tip", "A quick tip that saves you {the problem}.", ["quick-tip"]],
    ["any-before-you", "Before you {the action}, read this.", ["quick-tip", "myth-vs-fact"]],
    ["any-we-get-asked", "We get asked this every week: \"{the question}\"", ["faq-answered"]],
    ["any-milestone", "{The milestone}. Thank you for every single one.", ["milestone"]],
    ["any-impact", "This is why we do it.", ["community-impact"]],
    ["any-hiring", "We're hiring a {role}, and here's what the job is really like.", ["hiring"]],
    ["any-proud", "Proud of this one.", []],
    ["any-today", "Today at {the business}:", []],
  ]),
  ...hooks(["any"], SOCIAL, [
    ["social-swipe", "Swipe to see how it turned out.", []],
    ["social-neighbors", "Hey {place}, quick look at what we've been up to.", ["local-love", "on-the-job"]],
    ["social-thank-you", "{Place}, thank you for showing up for us.", ["local-love", "community-impact"]],
  ]),
  ...hooks(["any"], [LI], [
    ["li-lesson", "{The project} taught me something I didn't expect.", ["lesson-learned"]],
    ["li-small-biz", "Running a small business means {a real moment}. Here's what that looked like this week.", ["lesson-learned", "behind-the-scenes"]],
    ["li-started", "{The milestone} ago, we started with {how it began}.", ["milestone"]],
    ["li-what-it-shows", "What one job taught our team about {the lesson}:", []],
  ]),
  ...hooks(["home"], ALL, [
    ["home-called-out", "We got called out for {the problem}. Here's what we found.", ["before-after", "on-the-job"]],
    ["home-same-house", "Same {room or system}. One day apart.", ["before-after"]],
    ["home-signs", "{Number} signs your {system} needs a look before {the season}.", ["signs-you-need"]],
    ["home-dont-wait", "Don't wait for {the problem} to call.", ["signs-you-need", "seasonal-reminder"]],
    ["home-van", "What's in our van, and why each piece matters.", ["tools-of-the-trade"]],
    ["home-myth", "\"{The myth}.\" Not quite. Here's why.", ["myth-vs-fact"]],
  ]),
  ...hooks(["restaurant"], SOCIAL, [
    ["food-everyone-asks", "The {dish} everyone asks about.", ["dish-spotlight"]],
    ["food-scratch", "Made from scratch: {dish}, start to finish.", ["how-its-made"]],
    ["food-or", "{Option one} or {option two}? Tell us in the comments.", ["this-or-that"]],
    ["food-new", "New on the menu: {dish}.", ["dish-spotlight", "seasonal-reminder"]],
  ]),
  ...hooks(["store"], SOCIAL, [
    ["store-just-in", "Just in: {item}.", ["new-arrival"]],
    ["store-pick", "{First name}'s pick this week, and why.", ["staff-pick"]],
    ["store-reset", "We reset {the section}. Swipe for the after.", ["before-after"]],
  ]),
  ...hooks(["coach"], ALL, [
    ["coach-method", "How I help clients {the result}, in {number} steps.", ["framework"]],
    ["coach-win", "A client came to me {where they started}. Here's what changed.", ["client-win"]],
    ["coach-myth", "The biggest myth about {the topic}:", ["myth-vs-fact"]],
  ]),
];

// =============================================================================
// Hashtags
// =============================================================================

/** Build hashtag rows that share niches, platforms and an optional trade word. */
function tags(niches: readonly PlaybookNiche[], platforms: readonly PostPlatform[], list: readonly string[], trade: string | null = null): PostHashtag[] {
  return list.map((tag) => ({ tag, niches, platforms, trade }));
}

const HASHTAGS: readonly PostHashtag[] = [
  ...tags(["any"], ALL, ["#SmallBusiness", "#LocalBusiness"]),
  ...tags(["any"], SOCIAL, ["#ShopLocal", "#SupportLocal", "#BehindTheScenes"]),
  ...tags(["any"], [LI], ["#SmallBusinessOwner", "#Entrepreneurship", "#Leadership", "#CommunityImpact"]),
  ...tags(["any"], ALL, ["#Nonprofit", "#GiveBack", "#Education", "#STEM"], "nonprofit"),
  ...tags(["any"], ALL, ["#Nonprofit", "#GiveBack", "#Education", "#STEM"], "non-profit"),

  ...tags(["home"], ALL, ["#HomeServices", "#HomeImprovement", "#HomeMaintenance"]),
  ...tags(["home"], SOCIAL, ["#BeforeAndAfter", "#Homeowner", "#HomeTips"]),
  ...tags(["home"], [LI], ["#SkilledTrades", "#Construction"]),
  ...tags(["home"], ALL, ["#HVAC", "#HeatingAndCooling", "#HVACLife", "#Furnace", "#AirConditioning"], "hvac"),
  ...tags(["home"], ALL, ["#HVAC", "#HeatingAndCooling", "#Furnace"], "heating"),
  ...tags(["home"], ALL, ["#Plumbing", "#Plumber", "#PlumbingLife"], "plumb"),
  ...tags(["home"], ALL, ["#Electrician", "#ElectricalWork"], "electric"),
  ...tags(["home"], ALL, ["#Landscaping", "#LawnCare", "#CurbAppeal"], "landscap"),
  ...tags(["home"], ALL, ["#Roofing", "#Roofer"], "roof"),
  ...tags(["home"], ALL, ["#CleaningService", "#CleanHome"], "clean"),

  ...tags(["restaurant"], ALL, ["#Foodie", "#LocalEats"]),
  ...tags(["restaurant"], SOCIAL, ["#FoodLover", "#Yummy", "#EatLocal", "#ChefLife"]),
  ...tags(["restaurant"], [LI], ["#Hospitality", "#RestaurantBusiness"]),
  ...tags(["restaurant"], ALL, ["#Bakery", "#FreshBaked"], "bak"),
  ...tags(["restaurant"], ALL, ["#Coffee", "#CoffeeShop"], "caf"),
  ...tags(["restaurant"], ALL, ["#Coffee", "#CoffeeShop"], "coffee"),
  ...tags(["restaurant"], ALL, ["#Pizza", "#PizzaLover"], "pizz"),
  ...tags(["restaurant"], ALL, ["#BBQ", "#Barbecue"], "bbq"),

  ...tags(["store"], ALL, ["#Retail", "#ShopSmall"]),
  ...tags(["store"], SOCIAL, ["#NewArrivals", "#InStock", "#CornerStore"]),
  ...tags(["store"], [LI], ["#RetailBusiness", "#SmallRetail"]),

  ...tags(["coach"], ALL, ["#Coaching", "#PersonalGrowth"]),
  ...tags(["coach"], SOCIAL, ["#Motivation", "#Mindset", "#GoalSetting"]),
  ...tags(["coach"], [LI], ["#ProfessionalDevelopment", "#CareerGrowth", "#BusinessCoach"]),
  ...tags(["coach"], ALL, ["#FitnessCoach", "#Fitness"], "fitness"),
  ...tags(["coach"], ALL, ["#Tutoring", "#Education"], "tutor"),
];

/** The starting playbook every deployment seeds. */
export const PLAYBOOK_SEED: PostPlaybook = { formats: FORMATS, hooks: HOOKS, hashtags: HASHTAGS };
