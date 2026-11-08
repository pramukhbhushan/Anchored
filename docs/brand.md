# Anchored brand

A working brand sheet for the boat-themed landing page. No logo yet; the wordmark is set in type until one is designed.

## What we are

Anchored helps small business owners find where AI saves them time, which tools fit, and what it all costs. Where no tool fits, five Anchored agents draft the work, and nothing reaches a customer until the owner taps Approve.

The people we talk to run an HVAC shop, a restaurant, a corner store or a coaching practice. They are not engineers. Every line on the page should make sense to them on first read.

## The idea behind the theme

The owner is the captain. The agents are the crew. Each agent is its own boat with one job, and the fleet sails together. The owner holds the helm: no message leaves port without their tap.

The anchor is the promise. It means steady, safe, in your control. It is the last thing on the page, beside the button that starts setup.

## Taglines

Primary:

> **Your crew is ready. You hold the helm.**

Alternates, by section:

| Use | Line |
| --- | --- |
| Hero | Five agents. One crew. You hold the helm. |
| Agents section | Every boat has one job. |
| Orchestration | Sail as a fleet. |
| Approval promise | Nothing leaves port without your say. |
| Final CTA | Drop anchor on busywork. |
| CTA button | Try it on my business (primary), Get started (nav) |

## Voice

- Plain words first, sailing words second. The theme adds color, never confusion. "Follow-up chases quotes that went quiet" beats "Follow-up trawls for lost leads".
- One nautical word per sentence at most.
- Say what the agent does, then what it never does. ("Drafts one text with two open times. Never sends without your tap.")
- No hype. No "revolutionize", no "supercharge".

## Color palette

Chosen direction: **Harbor Chart**, made more vibrant. It keeps the app's navy and signal yellow so the landing page and product feel like one place, and brightens the water.

### Core (light)

| Token | Name | Hex | Use |
| --- | --- | --- | --- |
| `--ink` | Hull Navy | `#11203B` | Text, line art, the wordmark |
| `--bg` | Harbor Fog | `#EEF3F6` | Page background |
| `--sheet` | Sail White | `#FFFFFF` | Cards, sails |
| `--ocean` | Ocean Blue | `#1C6DD0` | Main water, accent words in headings, links |
| `--lagoon` | Lagoon | `#1FB5C9` | Back wave, progress bars |
| `--deep` | Deep Water | `#0F3F86` | Front wave |
| `--signal` | Signal Yellow | `#FFCC33` | The one loud color: primary buttons, the "You" harbor, the anchor ring |
| `--muted` | Depth Grey | `#5A6880` | Captions |
| `--line` | Rope Line | `#CFD9E1` | Hairlines |

Rule carried over from the app: **signal yellow appears once per screen.**

### Core (dark)

| Token | Hex |
| --- | --- |
| `--ink` | `#E9F0F8` |
| `--bg` | `#07111F` |
| `--sheet` | `#0E1C30` |
| `--ocean` | `#3D8BFF` |
| `--lagoon` | `#2ED3E0` |
| `--deep` | `#0B2E66` |
| `--signal` | `#FFD43D` |
| `--muted` | `#8C9BB2` |
| `--line` | `#1F3350` |

The page has a light/dark toggle in the nav. It follows the system setting until the visitor picks one, then remembers the pick.

### Agent pennants

| Agent | Light | Dark |
| --- | --- | --- |
| Front Desk | `#FFCC33` | `#FFD43D` |
| Follow-up | `#1C6DD0` | `#5EA2FF` |
| Bookkeeping and Invoicing | `#16A06C` | `#34D399` |
| Content and Social | `#FF6A4D` | `#FF8166` |
| Internal Communications | `#E39B12` | `#F5B83D` |

### Contrast

- Hull Navy on Harbor Fog: about 13:1. Body text is safe.
- Hull Navy on Signal Yellow: about 10:1. The button label is always navy, never white.
- Depth Grey on Harbor Fog: about 5:1. Fine for captions, not for tiny text under 13px.

## Type

| Role | Face | Notes |
| --- | --- | --- |
| Display | Archivo, expanded (`font-stretch: 112%`), weight 800 to 850 | Already the app's display face. Wide letters read like hull lettering |
| Body | Public Sans, 400 and 600 | Already the app's body face |
| Data and labels | IBM Plex Mono, 400 and 500 | Coordinates, knots, skill names, small uppercase labels with 0.08em tracking |

Scale: 13 / 14 / 16 / 18 / 22 / 32 / 58px, matching `--fs-*` in the app, plus a hero size of clamp(48px, 9vw, 120px) for the landing page only.

## Line art and imagery

- Boats are drawn, not photographed: single-weight navy lines (1.5px at 1x), flat sail white fills, no gradients, no shadows.
- Water is a few horizontal lines or chart depth contours. Never a full blue fill.
- Each agent boat has a different hull so the five are easy to tell apart at small sizes:
  - Front Desk: a harbor launch, the first boat a customer meets
  - Follow-up: a sloop with a tall sail, built to go after things
  - Bookkeeping and Invoicing: a cargo barge with stacked crates
  - Content and Social: a catamaran with a wide, bright sail
  - Internal Communications: a lighthouse tender with a signal mast, always on
- The anchor appears once, at the end. Draw it in the same line weight, with signal yellow only on the ring.

## Motion

- Hero: scroll raises the tide. The boat rides the waves, sails right and shrinks, the headline drifts away, and a large "Anchored" wordmark settles on the waterline. The screen is never blank.
- Waves are three layered canvas waves that roll continuously; the boat tilts with the wave under it.
- Each animated section plays once when it scrolls into view and shows its finished state at rest: the catering reply types itself out on the phone, the scout checks catering tools and stamps its find, and the receipt prints.
- The Tuesday board plays one example day at Linden Street Kitchen (9:00 to 21:00): messages land in Waiting on you, then slide to Done or Held till morning with a stamp. It loops while it is on screen, and Replay the day restarts it.
- The five boats bob on one moving waterline.
- With `prefers-reduced-motion`, the boat sits still at its resting size and the water stops.

## Layout

- Full width, as the app's UI rules ask. Cap only running text at about 65 characters.
- Navigation: wordmark left; How it works, What it does, Pricing and Questions anchors in the middle; **Log in** (text button, `/login`) and **Get started** (yellow button, `/app/new`) on the right.
- Section order: hero boat, a catering reply on a phone, five jobs on one waterline, a scout's find, the Tuesday board, the real Approvals screen, the plan as a receipt, the rules, questions, and the anchor with the setup button.
- Show, don't describe. Each section shows a thing an owner recognizes (a phone, a receipt, a board of messages) and uses the app's sample restaurant, Linden Street Kitchen, so the page matches what a visitor sees in the app.
- One filled button per region.

## Where the buttons go

| Button | Destination | Why |
| --- | --- | --- |
| Get started, Try it on my business | `/app/new` | The chat onboarding for a new business. With accounts on, the middleware sends signed-out visitors to `/login?next=/app/new` first |
| Log in | `/login` | The sign-in page |

## Not yet

- Logo. Use the word "Anchored" in Archivo 850, expanded, until a mark is designed.
- Photography and illustration beyond line art.
