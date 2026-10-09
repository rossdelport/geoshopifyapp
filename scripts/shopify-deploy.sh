#!/bin/sh
# Publishes the app's Shopify settings (URLs, webhooks, scopes) and extensions (visit tracker,
# FAQ theme block) on every Railway deploy. Runs only when SHOPIFY_APP_AUTOMATION_TOKEN is set
# (Dev Dashboard -> GEO -> Settings -> App Automation Token). Never stops the web app starting.
if [ -z "$SHOPIFY_APP_AUTOMATION_TOKEN" ]; then
  echo "[shopify-deploy] SHOPIFY_APP_AUTOMATION_TOKEN not set; skipping Shopify publish."
  exit 0
fi
echo "[shopify-deploy] publishing app settings and extensions to Shopify..."
if npx -y @shopify/cli@3 app deploy --allow-updates --message "Railway ${RAILWAY_GIT_COMMIT_SHA:-deploy}"; then
  echo "[shopify-deploy] done."
else
  echo "[shopify-deploy] FAILED (the app still starts; check the lines above)."
fi
exit 0
