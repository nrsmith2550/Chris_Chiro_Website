# Chris Eddins Chiropractic: Booking Site

Online booking for Dr. Chris Eddins. Patients book without an account; Chris manages everything from a password-protected front desk page.

- **Adjustment:** 15 minutes, for returning patients
- **New patient visit:** 30 minutes, for first-time patients

## How it works

| Part | What it does |
| --- | --- |
| `index.html` + `book.js` | Patient booking page: pick a visit, day and time, enter details, get a confirmation. "My visits" lists visits booked from that browser and lets the patient cancel them. |
| `admin.html` + `admin.js` | Front desk (`/admin.html`): sign in with the office password, see today / next 7 days / upcoming / past, search, edit (type, date, time, patient details) and cancel visits. |
| `core.js`, `styles.css` | Shared by both pages. |
| `api/` | Vercel serverless functions: `availability`, `book`, `manage` (patient lookup/cancel), `admin`. |
| `lib/schedule.js` | **Office hours, visit types, booking window. Edit this file to change the schedule.** |
| Neon Postgres | `appointments` and `blocks` tables. Each 15-minute block can only be held by one visit, so double-booking is impossible even if two people click at the same moment. |

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string for project **eddins-chiropractic**, branch **main** (Neon console → Connect). |
| `ADMIN_PASSWORD` | The password Chris uses on the front desk page. At least 8 characters; use a long one. |

After adding or changing them, redeploy.

## Settings

Edit `lib/schedule.js`:

- `HOURS`: office hours per weekday (0 = Sunday), as `[open, close]` sessions in Eastern time
- `DAYS_AHEAD`: how far ahead patients can book (21 days)
- `MIN_LEAD_MIN`: minimum notice for online bookings (60 minutes). The front desk can book any open time.
- `SERVICES`: visit names, lengths and descriptions

## Privacy notes

- The public availability API returns only taken times, never names or contact details.
- Patients can only see or cancel a visit with the private token their browser received when they booked.
- Cancelled visits are kept (status `cancelled`) for the office's records.
- This is a scheduling tool, not a medical record system. Patients' notes are free text; don't use it to store clinical records.

## Local development

```
npm install
DATABASE_URL=... ADMIN_PASSWORD=... npx vercel dev
```

Opened anywhere without the API (a local file, GitHub Pages), the pages run in preview mode with example data and save nothing.
