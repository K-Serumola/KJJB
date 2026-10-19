# KKJB: Geolocation Ride-Sharing App

An Expo (React Native) ride-sharing app for affordable urban commuting in Botswana. Drivers post rides with spare seats, passengers search for a journey, and the app matches them by route overlap, ranks the results and lets the driver accept or decline each request.

## Features

- Sign up / log in (Supabase Auth); a profile row is created automatically on signup
- Profile: edit name, switch between driver and passenger, log out
- Driver: post a ride, view incoming requests, accept or decline (accepting takes seats off the ride)
- Passenger: find a ride (matching), request a ride, browse all active rides, view and cancel own requests
- Server-side matching in a Supabase Edge Function: pickup distance, detour, time difference and a 0-100 score

## Tech Stack

- React Native with Expo and Expo Router (file-based navigation)
- Supabase: Auth, Postgres (with Row Level Security) and Edge Functions
- Matching: straight-line distance for now, structured so the Google Maps Routes API can be swapped in later

## Prerequisites

- Node.js 18 or newer
- The Expo Go app on your phone (same Wi-Fi as your computer)
- Access to the team's Supabase project (ask a teammate for the URL and anon key)

## Setup

1. Clone the repo and open the folder that contains `package.json` (`kkjb`):

   ```bash
   git clone <repo-url>
   cd kkjb
   ```

2. Install dependencies. The flag is required because of peer-dependency conflicts in the Expo packages:

   ```bash
   npm install --legacy-peer-deps
   ```

3. Create a `.env` file next to `package.json`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   Find both in the Supabase dashboard under **Project Settings -> API**. Use the `anon` key only, never the `service_role` key. `.env` is git-ignored, so never commit it.

4. Start the app and scan the QR code with Expo Go:

   ```bash
   npx expo start -c
   ```

## Database

Only needed when setting up a new Supabase project. The shared team project is already set up.

1. In the Supabase dashboard open **SQL Editor -> New query**, paste the contents of `supabase/schema.sql` and run it. This creates `profiles`, `rides`, `ride_requests` and `match_results`, plus indexes, a signup trigger and RLS policies. **It drops existing tables first.**
2. For development, turn off email confirmation under **Authentication -> Sign In / Providers -> Email -> Confirm email**.

## Edge Function (matching)

The matching logic lives in `supabase/functions/find-matches/index.ts`. Redeploy it after changing it:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase functions deploy find-matches
```

`<project-ref>` is the part of the Supabase URL before `.supabase.co`. No secrets need to be set, because Supabase provides the URL and keys to the function automatically.

## How matching works

1. The passenger submits a journey (pickup, destination, time, seats).
2. The function loads active rides that have not left yet, have enough seats and belong to someone else.
3. Each ride is kept only if the pickup and drop-off are close to the driver's route, travel in the same direction, need a small detour and leave within the time window.
4. Matches get a 0-100 score (closer pickup, smaller detour and closer time score higher), are saved to `match_results` and returned ranked.

Thresholds are set at the top of `MatchingService`: pickup 1000 m, detour 3000 m, time window 60 min.

## Project Structure

```
kkjb/
├── app/                      # screens (Expo Router)
│   ├── _layout.tsx           # root layout and auth redirect
│   ├── index.tsx
│   ├── (auth)/               # login, signup
│   └── (tabs)/               # home (find a ride), post-ride, requests, rides/, profile
├── lib/supabase.ts           # Supabase client
├── services/                 # profileService, rideService, requestService
├── types/index.ts            # Profile, Ride, RideRequest, MatchResult types
├── supabase/
│   ├── schema.sql            # database schema
│   └── functions/find-matches/index.ts   # matching edge function
├── assets/
├── app.json
└── package.json
```

## Testing the Main Flow

You need two accounts: one driver and one passenger (switch role on the Profile tab).

1. As the driver: Post Ride, then submit with the default values.
2. As the passenger: Home -> Find rides, then Request this ride.
3. As the driver: Requests -> Accept. The ride's `seats_available` drops.

## Troubleshooting

- **Dependency conflicts on install:** use `npm install --legacy-peer-deps`.
- **"Unable to resolve <package>" when bundling:** install it with `npx expo install <package>`.
- **Bundling errors after changing entry files, `.env` or packages:** run `npx expo start -c`.
- **"Element type is invalid ... undefined":** a screen file under `app/` is empty or has no `export default`.
- **Login says "Email not confirmed":** turn off **Confirm email** in Supabase (see Database).
- **App cannot reach Supabase:** the free-tier project may be paused. Open the project in the dashboard and click **Restore project**.
- **Commands say "Project root directory not found":** run them from the folder that contains `package.json`.

## Team

- _Add names and roles here_
