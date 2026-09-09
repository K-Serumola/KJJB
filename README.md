# KKJB — Geolocation Ride-Sharing App

Affordable, Expo-based ride-sharing app for Botswana. Matches drivers with spare seats to passengers heading the same way, using route-overlap matching.

## Tech Stack

- React Native (Expo)
- Expo Router (file-based navigation)
- Supabase (auth + database)
- Google Maps Routes API (routing/matching)

## Prerequisites

- Node.js ≥ 18
- Expo Go app on your phone (for testing)
- A Supabase project (ask a teammate for access or credentials)

## Setup

1. Clone the repo and install dependencies:

```bash
   git clone <repo-url>
   cd kkjb
   npm install --legacy-peer-deps
```

2. Create a `.env` file in the project root:

```
   EXPO_PUBLIC_SUPABASE_URL=https://lagqmieiuhpguuqydtzp.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=(your-anon-key(from supabase))
```

   Get these from Supabase dashboard → Settings → API. Don't commit this file.

3. Run the app:

```bash
   npx expo start
```

   Scan the QR code with Expo Go.

## Project Structure

```
app/
  (auth)/       # login, signup
  (tabs)/       # home, rides, profile (main app screens)
  _layout.tsx   # root navigation layout
  index.tsx     # entry redirect → login
lib/
  supabase.ts   # Supabase client config
```

## Troubleshooting

- **Dependency conflicts on install**: use `npm install --legacy-peer-deps` (already set as default via `.npmrc`)
- **Bundling errors after changing entry files**: run `npx expo start -c` to clear cache

## Team

- [add names/roles here]
