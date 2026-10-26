@echo off
setlocal
title RideShare Botswana - setup
echo.
echo ===== RideShare Botswana: one-time setup =====
echo.

rem --- 1. Is Node.js installed? ---
where node >nul 2>nul
if errorlevel 1 goto no_node
echo [OK] Node.js found:
node -v

rem --- 2. Are we in the project folder? ---
if not exist package.json goto no_package

rem --- 3. Install every package listed in package.json ---
echo.
echo Installing packages. This takes a few minutes the first time...
call npm install
if errorlevel 1 goto npm_failed
echo [OK] Packages installed.

rem --- 3b. The two packages the app needs for sign-in (saved session + URL support) ---
echo.
echo Making sure the sign-in packages match this Expo version...
call npx expo install @react-native-async-storage/async-storage react-native-url-polyfill
if errorlevel 1 goto npm_failed
call npm ls @react-native-async-storage/async-storage react-native-url-polyfill
echo [OK] Sign-in packages checked.

rem --- 4. Create the .env file with the Supabase details ---
if exist .env goto have_env
echo.
echo The app needs two Supabase values. Ask Jaden or Kaene for the anon key
echo (Supabase dashboard, Project Settings, API). Never share the service_role key.
set "SB_URL=https://lagqmieiuhpguuqydtzp.supabase.co"
set "SB_URL_IN="
set /p "SB_URL_IN=Supabase URL, press Enter to use %SB_URL% : "
if not "%SB_URL_IN%"=="" set "SB_URL=%SB_URL_IN%"
set "SB_KEY="
set /p "SB_KEY=Supabase anon key: "
if "%SB_KEY%"=="" goto no_key
> .env echo EXPO_PUBLIC_SUPABASE_URL=%SB_URL%
>> .env echo EXPO_PUBLIC_SUPABASE_ANON_KEY=%SB_KEY%
echo [OK] .env file created.
goto after_env

:have_env
echo [OK] .env already exists, leaving it alone.
goto after_env

:no_key
echo [!] No key entered, so no .env was made. Make a file called .env yourself later:
echo     EXPO_PUBLIC_SUPABASE_URL=...
echo     EXPO_PUBLIC_SUPABASE_ANON_KEY=...

:after_env
echo.
echo ===== Done =====
echo 1. Install "Expo Go" on your phone (App Store or Play Store).
echo 2. Keep the phone and this computer on the same Wi-Fi.
echo 3. Start the app with:  npx expo start -c   then scan the QR code.
echo.

rem --- 5. ONLY for whoever owns the Supabase project ---
echo Edge Functions (search-places, compute-route, find-matches) are already online.
echo Only the Supabase owner needs to deploy them again, after changing their code.
set "DEPLOY="
set /p "DEPLOY=Deploy the Edge Functions now? Most people answer n (y/n): "
if /i not "%DEPLOY%"=="y" goto ask_start
echo.
echo Signing in to Supabase. A browser window opens, approve it there.
call npx supabase login
if errorlevel 1 goto deploy_failed
call npx supabase functions deploy search-places --use-api --project-ref lagqmieiuhpguuqydtzp
call npx supabase functions deploy compute-route --use-api --project-ref lagqmieiuhpguuqydtzp
call npx supabase functions deploy find-matches --use-api --project-ref lagqmieiuhpguuqydtzp
echo.
echo Reminder: the GOOGLE_ROUTES_API_KEY secret is set in the Supabase dashboard,
echo under Edge Functions, Secrets. The deploy does not touch it.
goto ask_start

:deploy_failed
echo [!] Supabase login did not finish, so nothing was deployed.

:ask_start
echo.
set "GO="
set /p "GO=Start the app now? (y/n): "
if /i "%GO%"=="y" call npx expo start -c
goto end

:no_node
echo [X] Node.js is not installed. Install the LTS version from https://nodejs.org
echo     then double-click this file again.
goto end

:no_package
echo [X] I can't find package.json. Put this file in the project folder
echo     (the one that contains package.json) and run it again.
goto end

:npm_failed
echo [X] npm install failed. Read the red text above. Common fixes:
echo     - check your internet connection
echo     - delete the node_modules folder and run this file again

:end
echo.
pause
endlocal
