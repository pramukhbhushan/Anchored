# Test persona: Brightpath Coaching

A made-up career coaching agency for testing the Bookkeeping agent by hand. Every customer email ends in `@example.com`, so nothing reaches a real person.

## The business

| Field | Value |
| --- | --- |
| Name | Brightpath Coaching |
| Trade | Career coaching agency |
| Place | College Park, MD |
| Team | The owner plus one part-time coach |
| Hours | Weekdays, 9 a.m. to 6 p.m. Eastern |
| Tools | Google Workspace (Gmail, Google Sheets), Calendly, Zoom |
| Payments | Invoices by email, tracked in a Google Sheet. Clients pay by Zelle or card link, usually within 14 days |

### Services and prices

| Service | Price |
| --- | --- |
| Single coaching session | $175 |
| Interview prep (2 sessions) | $300 |
| Career coaching package (3 sessions) | $450 |
| Leadership workshop seat | $600 |
| Executive coaching retainer | $1,200 a month |

## Onboarding answers

Paste these when onboarding asks.

**Start:**
```
Brightpath Coaching, a career coaching agency in College Park
```

**What do you sell, who buys it, and roughly what does it cost?**
```
We sell 1-on-1 career coaching to early and mid-career professionals in the DC area. A single coaching session is $175, interview prep (2 sessions) is $300, a career coaching package (3 sessions) is $450, a leadership workshop seat is $600, and an executive coaching retainer is $1,200 a month. Most clients are referred or find us on LinkedIn.
```

**How do customers reach you, or how do you get leads?**
```
Mostly LinkedIn messages, email, and referrals from past clients. Some people book through a form on our website.
```

**What tools do you use?**
```
Google Workspace (Gmail and Google Sheets), Calendly for booking, Zoom for sessions. We track invoices in a Google Sheet.
```

**How do you get paid, or what's slow or annoying?**
```
We send invoices by email and track them in a Google Sheet. Clients pay by Zelle or card link, usually within 14 days. A few clients pay late every month and I forget to follow up, so chasing unpaid invoices takes a lot of my time.
```

**Team size or hours?**
```
It's just me plus one part-time coach. We work weekdays 9 a.m. to 6 p.m. Eastern.
```

**Anything else, or what do you want help with?**
```
Following up on late invoices, replying to new leads faster, and reminding clients about upcoming sessions.
```

## Test steps

### 1. Start the app with sign-in off

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run dev -- -p 3102
```

Open http://localhost:3102. Data is kept in memory and resets when the server restarts. Use an incognito window if a browser extension such as Grammarly shows a hydration warning.

### 2. Onboard

Use the onboarding answers above. To answer them for you, open the browser console on the app and paste [`scripts/onboard-brightpath.js`](../../scripts/onboard-brightpath.js).

### 3. Turn on Bookkeeping

In **Workflows**, set the payment reminders workflow to **Anchored drafts it**.

### 4. Chat

Type each line into the business Chat, one at a time.

| Type | Expected reply |
| --- | --- |
| `Maya Chen owes $450 on invoice 1042, due Oct 20` | "Bookkeeping and Invoicing drafted a reminder to Maya Chen for $450 on invoice 1042. It's waiting in Approvals." A reminder card appears in Approvals |
| `Jordan still owes me` | "How much does Jordan owe? I'll only use the amount you give me." No card |
| `Maya Chen owes $450 on invoice 1042` (twice more) | The second works. The third says "Invoice 1042 already has 2 reminders. Anchored won't send a third." |
| `Maya paid 1042` | "Marked invoice 1042 from Maya paid. I stopped ... reminders that were waiting." |
| `We paid $300 for new ads last month` | A normal profile reply. Not treated as an invoice |

### 5. Approvals

Every reminder shows the exact amount, invoice number and due date from the chat, with no late fee. A reminder to a contact who opted out is drafted but never emailed.
