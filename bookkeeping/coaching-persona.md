# Test persona: Brightpath Coaching

A made-up career coaching agency for testing the Bookkeeping agent. Every customer email ends in `@example.com`, so nothing reaches a real person.

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

## The invoice sheet

Make a Google Sheet named "Brightpath Coaching invoices" with the rows below, and share it as a Viewer with the `client_email` of the service account in `GOOGLE_SERVICE_ACCOUNT_JSON`.

| Invoice # | Customer | Email | Amount | Due date | Status | What it tests (as of Nov 8, 2026) |
| --- | --- | --- | --- | --- | --- | --- |
| 1042 | Maya Chen | maya.chen@example.com | $450 | 2026-10-20 | Unpaid | Overdue, gets a reminder |
| 1043 | Jordan Ellis | jordan.ellis@example.com | $1,200 | 2026-10-28 | Unpaid | Overdue. Change to "Paid" during the test to show the cancel |
| 1044 | Priya Patel | priya.patel@example.com | $300 | 2026-11-20 | Unpaid | Not due yet, no reminder |
| 1045 | Sam Lee | sam.lee@example.com | $240 | 2026-10-15 | Paid | Already paid, no reminder |
| (blank) | Dev Rao | dev.rao@example.com | $175 | 2026-10-30 | Unpaid | No invoice number, matched by email and amount |
| 1046 | Maya Chen | maya.chen@example.com | $90 | 2026-11-01 | Unpaid | Second invoice for the same client, counted separately |
| 1047 | Alex Romero | alex.romero@example.com | $600 | 2026-10-25 | Unpaid | The opted-out contact: a reminder is drafted but never emailed |

## Test steps

### 1. Start the app with sign-in off

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run dev -- -p 3102
```

Open http://localhost:3102. Data is kept in memory and resets when the server restarts. Use an incognito window if a browser extension such as Grammarly shows a hydration warning.

### 2. Onboard

Use the onboarding answers above.

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

### 5. Google Sheet

Restart the server first if you want a clean slate, then onboard again.

| Do | Expected |
| --- | --- |
| Paste `here's my invoice sheet https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit` | "Connected your invoice sheet. I checked your invoice sheet: 7 invoices. I drafted 5 reminders for overdue invoices. They're waiting in Approvals. 1 isn't due yet." |
| Type `check my invoice sheet` | "5 overdue invoices already have a reminder." Nothing drafted twice |
| In the sheet, change 1043's Status to `Paid`, then type `check my invoice sheet` | "I stopped 1 reminder for invoices now marked paid." |
| Change 1043 back to `Unpaid` afterward | Resets the sheet for the next test |

### 6. Approvals

Every reminder shows the exact amount, invoice number and due date from the sheet or chat, with no late fee. Invoice 1047 (Alex Romero) only stays unsent if Alex is saved as a contact who opted out. Otherwise it behaves like the others.
