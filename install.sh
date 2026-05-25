#!/usr/bin/env bash
set -e

REPO="bellazhuang417-cyber/inkwell"
INSTALL_DIR="/Applications"

echo "Fetching latest Inkwell release..."

TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"tag_name"' | cut -d'"' -f4)

if [ -z "$TAG" ]; then
  echo "Error: could not fetch release info. Check your internet connection."
  exit 1
fi

ASSET="Inkwell_${TAG}_aarch64.tar.gz"
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"
TMP=$(mktemp -d)

echo "Downloading $ASSET..."
curl -fsSL "$URL" -o "$TMP/$ASSET"

echo "Extracting..."
tar -xzf "$TMP/$ASSET" -C "$TMP"

# Remove macOS quarantine flag so the app opens without Gatekeeper blocking
xattr -cr "$TMP/Inkwell.app" 2>/dev/null || true

echo "Installing to $INSTALL_DIR..."
if [ -d "$INSTALL_DIR/Inkwell.app" ]; then
  rm -rf "$INSTALL_DIR/Inkwell.app"
fi
mv "$TMP/Inkwell.app" "$INSTALL_DIR/"

rm -rf "$TMP"

echo ""
echo "Done! Inkwell $TAG is installed."
echo "Open it from Applications or run: open /Applications/Inkwell.app"
