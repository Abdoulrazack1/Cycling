#!/bin/bash
# Setup Capacitor pour wrapper Android/iOS de l'app
# Usage : bash scripts/setup-mobile.sh
#
# Pré-requis :
#   - Node 18+
#   - Pour Android : Android Studio (https://developer.android.com/studio)
#   - Pour iOS : macOS + Xcode

set -e
cd "$(dirname "$0")/.."

echo "=== Install Capacitor ==="
npm install --save-dev @capacitor/core @capacitor/cli
npm install --save @capacitor/android @capacitor/ios @capacitor/splash-screen @capacitor/status-bar

echo ""
echo "=== Init project (si pas déjà fait) ==="
if [ ! -d "android" ] && [ ! -d "ios" ]; then
  npx cap init "C.C. Salouel" "fr.cc-salouel.app" --web-dir=.
fi

# Sync la config
npx cap sync 2>/dev/null || true

echo ""
echo "=== Android ==="
read -p "Setup Android ? (o/n) " android_ok
if [ "$android_ok" = "o" ]; then
  npx cap add android 2>/dev/null || echo "Android déjà ajouté"
  npx cap sync android
  echo "→ Ouvre Android Studio :"
  echo "    npx cap open android"
  echo "→ Build APK debug : Build → Build Bundle(s)/APK(s) → Build APK(s)"
  echo "→ Build AAB pour Play Store : Build → Generate Signed Bundle/APK"
fi

echo ""
echo "=== iOS (macOS uniquement) ==="
if [ "$(uname)" = "Darwin" ]; then
  read -p "Setup iOS ? (o/n) " ios_ok
  if [ "$ios_ok" = "o" ]; then
    npx cap add ios 2>/dev/null || echo "iOS déjà ajouté"
    npx cap sync ios
    echo "→ Ouvre Xcode :"
    echo "    npx cap open ios"
  fi
else
  echo "iOS skip (nécessite macOS + Xcode)"
fi

echo ""
echo "=== Setup terminé ==="
echo "Capacitor config : capacitor.config.json"
echo "L'app pointera vers : https://cc-salouel.fr"
echo "Pour changer l'URL : éditer server.url dans capacitor.config.json puis npx cap sync"
