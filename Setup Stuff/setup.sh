#!/usr/bin/env bash
# RideShare Botswana: one-time setup for Mac / Linux.
# Run it from the project folder:  bash setup.sh
set -e

echo
echo "===== RideShare Botswana: one-time setup ====="
echo

# 1. Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[X] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  exit 1
fi
echo "[OK] Node.js found: $(node -v)"

# 2. Right folder?
if [ ! -f package.json ]; then
  echo "[X] I can't find package.json. Run this from the project folder."
  exit 1
fi

# 3. Install every package listed in package.json
echo
echo "Installing packages. This takes a few minutes the first time..."
npm install
echo "[OK] Packages installed."

# 3b. The two packages the app needs for sign-in (saved session + URL support)
echo
echo "Making sure the sign-in packages match this Expo version..."
npx expo install @react-native-async-storage/async-storage react-native-url-polyfill
npm ls @react-native-async-storage/async-storage react-native-url-polyfill || true
echo "[OK] Sign-in packages checked."

# 4. .env with the Supabase details
if [ -f .env ]; then
  echo "[OK] .env already exists, leaving it alone."
else
  echo
  echo "The app needs two Supabase values. Ask Jaden or Kaene for the anon key"
  echo "(Supabase dashboard > Project Settings > API). Never share the service_role key."
  DEFAULT_URL="https://lagqmieiuhpguuqydtzp.supabase.co"
  read -r -p "Supabase URL [Enter for $DEFAULT_URL]: " SB_URL
  SB_URL=${SB_URL:-$DEFAULT_URL}
  read -r -p "Supabase anon key: " SB_KEY
  if [ -z "$SB_KEY" ]; then
    echo "[!] No key entered, so no .env was made. Create a .env file yourself later with:"
    echo "    EXPO_PUBLIC_SUPABASE_URL=..."
    echo "    EXPO_PUBLIC_SUPABASE_ANON_KEY=..."
  else
    printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$SB_URL" "$SB_KEY" > .env
    echo "[OK] .env file created."
  fi
fi

echo
echo "===== Done ====="
echo "1. Install 'Expo Go' on your phone (App Store or Play Store)."
echo "2. Keep the phone and this computer on the same Wi-Fi."
echo "3. Start the app with:  npx expo start -c   then scan the QR code."
echo

# 5. ONLY for whoever owns the Supabase project
echo "Edge Functions (search-places, compute-route, find-matches) are already online."
echo "Only the Supabase owner needs to deploy them again, after changing their code."
read -r -p "Deploy the Edge Functions now? Most people answer n (y/n): " DEPLOY
if [ "$DEPLOY" = "y" ] || [ "$DEPLOY" = "Y" ]; then
  echo "Signing in to Supabase. A browser window opens, approve it there."
  if npx supabase login; then
    npx supabase functions deploy search-places --use-api --project-ref lagqmieiuhpguuqydtzp
    npx supabase functions deploy compute-route --use-api --project-ref lagqmieiuhpguuqydtzp
    npx supabase functions deploy find-matches --use-api --project-ref lagqmieiuhpguuqydtzp
    echo
    echo "Reminder: the GOOGLE_ROUTES_API_KEY secret is set in the Supabase dashboard,"
    echo "under Edge Functions > Secrets. The deploy does not touch it."
  else
    echo "[!] Supabase login did not finish, so nothing was deployed."
  fi
fi

echo
read -r -p "Start the app now? (y/n): " GO
if [ "$GO" = "y" ] || [ "$GO" = "Y" ]; then
  npx expo start -c
fi
