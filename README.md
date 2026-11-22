# Chris Eddins Chiropractic: Booking Site

A one-page booking website for Dr. Chris Eddins. Patients choose a visit type, pick a day and time, and enter their details.

- **Adjustment:** 15 minutes, for returning patients
- **New patient visit:** 30 minutes, for first-time patients (needs two back-to-back 15-minute blocks)

## Files

- `index.html` is the whole site: markup, styles and script in one file, with no build step.

## Settings

Edit the constants at the top of the `<script>` in `index.html`:

- `HOURS`: office hours per weekday (0 = Sunday). Each day lists `[open, close]` sessions. **The current hours are placeholders.**
- `DAYS_AHEAD`: how many days ahead patients can book (default 21).
- `MIN_LEAD_MIN`: the minimum notice for a booking, in minutes (default 60).
- `SERVICES`: visit names, lengths and descriptions.

## Storage

The live version runs as a Claude artifact. It uses the artifact's shared database to store bookings:

- `busy/<userId>`: times only, readable by everyone, so booked times disappear for everyone else
- `appts/<userId>`: full patient details, readable only by the patient and the owner (front-desk view)

If you open `index.html` anywhere else, such as GitHub Pages or a local file, it runs in **preview mode**: it shows example booked times and doesn't save anything. To run it as a public site, swap the `connect()`, `writeMine()` and `cancelBooking()` functions for calls to a real backend, for example a small API on Vercel backed by Postgres.
