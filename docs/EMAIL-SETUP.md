# Email setup (Resend)

The website already sends its emails through [Resend](https://resend.com). Until an API key is
added, nothing is sent: every email is written to **Admin → Settings → Recent emails** as
"Not sent", and bookings, orders and accounts work normally.

## What gets sent

| Email | To | When |
|---|---|---|
| Booking received | Guest (EN/NL) | A guest books on the website |
| Booking confirmed + calendar invite (.ics) | Guest | Staff confirm a booking, or add a confirmed phone booking with an email address |
| Booking cancelled | Guest | Staff cancel a booking |
| Order received / Order ready | Guest | Takeaway order placed / marked Ready |
| New booking request / New order | Team | A booking or order comes in from the website |
| Invite / Password reset | Team member | Added in Team, or "Forgot password?" on the sign-in page |

Guests can reply to every email; replies go to the restaurant email in Settings.
Each switch (guest emails, team alerts) and the alert address can be changed in **Settings → Email**.
Staff can untick "Email the guest" in the booking dialog to make a change quietly.

## 1. Resend account and domain

1. Create an account at resend.com.
2. **Domains → Add domain.** Use `yerevanrestaurant.nl`, or a subdomain such as
   `mail.yerevanrestaurant.nl` to keep the main domain's own email (Google Workspace, Outlook…) separate.
   Choose the **EU (Ireland)** region.
3. Resend shows a few DNS records (SPF and DKIM, usually also an MX record for bounces).
   Add exactly those records at the domain's DNS provider, then click **Verify**. This usually takes
   minutes, sometimes a few hours.
4. Recommended: also add a DMARC record if the domain doesn't have one yet:
   `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:info@yerevanrestaurant.nl`

## 2. API key

**API Keys → Create API key**, permission **Sending access**, limited to the domain above.
Copy the key (it starts with `re_`); Resend shows it only once.

## 3. Add it to Vercel

From the project folder:

```bash
vercel env add RESEND_API_KEY production
vercel env add EMAIL_FROM production
vercel --prod
```

- `RESEND_API_KEY`: the key from step 2.
- `EMAIL_FROM`: the sender, on the verified domain, e.g.
  `Yerevan Restaurant <reserveringen@yerevanrestaurant.nl>` (default if not set).

Optional:
- `EMAIL_REPLY_TO`: where guest replies go, if not the restaurant email in Settings.
- `SITE_URL`: the public address used in links (default `https://yerevan-restaurant.vercel.app`).
  Change it when the site moves to its own domain.

## 4. Test

**Admin → Settings → Email** should now say **Connected**. Use **Send test** and check the
inbox (and spam folder the first time). Every email appears in **Recent emails** with its status;
failed ones show Resend's error when you hover the badge.
