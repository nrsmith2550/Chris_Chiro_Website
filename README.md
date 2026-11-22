# Chris Eddins Chiropractic: Booking Site

A one-page booking website for Dr. Chris Eddins. Patients choose a visit type, pick a day and time, and enter their details.

- **Adjustment:** 15 minutes, for returning patients
- **New patient visit:** 30 minutes, for first-time patients (needs two back-to-back 15-minute blocks)

## Admin portal

Open `admin.html` (or click **Front desk** in the booking page's header, which only appears for the owner). Chris can:

- See today's count, the next 7 days, upcoming new patients, and who's next
- Filter by Today, Next 7 days, All upcoming, or Past, and search by name, phone or email
- Edit a visit: change the type, date and time (only open times are offered) and the patient's details
- Cancel a visit (tap twice to confirm)

Patients who open `admin.html` see an "Office only" message. In preview mode, the portal shows clearly labelled example appointments.

## Files

- `index.html`: the patient booking page
- `admin.html`: the front desk portal
- `styles.css`: shared styles
- `core.js`: shared settings, availability logic and booking storage (load it first on both pages)
- `book.js`: the booking page's script
- `admin.js`: the portal's script

There's no build step.

## Settings

Edit the constants at the top of `core.js`:

- `HOURS`: office hours per weekday (0 = Sunday). Each day lists `[open, close]` sessions. **The current hours are placeholders.**
- `DAYS_AHEAD`: how many days ahead patients can book (default 21).
- `MIN_LEAD_MIN`: the minimum notice for a booking, in minutes (default 60).
- `SERVICES`: visit names, lengths and descriptions.

## Storage

The live version runs as a Claude artifact. It uses the artifact's shared database to store bookings:

- `busy/<userId>`: times only, readable by everyone, so booked times disappear for everyone else
- `appts/<userId>`: full patient details, readable only by the patient and the owner (front-desk view)

If you open the pages anywhere else, such as GitHub Pages or a local file, it runs in **preview mode**: it shows example booked times and doesn't save anything. To run it as a public site, swap the `connect()`, `writeMine()` and `adminWrite()` functions in `core.js` for calls to a real backend, for example a small API on Vercel backed by Postgres.
