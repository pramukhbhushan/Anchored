# Security policy

Anchored is a finished hackathon project. Reports are welcome, with no promise of a quick fix.

## Report a vulnerability

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue, pull request or discussion for it.

Say what an attacker could do, the steps to reproduce it, and the commit or deployment you tested. Leave out real customer data, keys and tokens.

## Scope

In scope: this repository's code, such as the session and account checks, the `Store` session filters, the send rules in `checkSend`, the webhook signature checks, and the AI call budget.

Out of scope: a deployment someone else runs, and the services Anchored connects to, such as Supabase, Twilio, Stripe, Resend and Telegram. Report those to their owners.

## How Anchored protects data

[docs/security.md](docs/security.md) lists each control, the file that holds it, and its known limits.
