import type { CapacitorConfig } from "@capacitor/cli";

// ⚠️ IMPORTANT: this app has server-side code (Stripe, Supabase admin
// operations, AI calls) that can only run on a real server — never inside
// the phone itself. That's why the native app loads the LIVE PUBLISHED URL
// below instead of a locally bundled copy of the code.
//
// TODO once you have it: replace the placeholder with your real Lovable
// published URL (Lovable → Publish button → copy the https://*.lovable.app
// URL, or your custom domain if you attached one).
const PUBLISHED_URL = "https://REPLACE-ME.lovable.app";

const config: CapacitorConfig = {
  appId: "app.lovable.modelzon",
  appName: "MODELZON",
  webDir: "www",
  server: {
    url: PUBLISHED_URL,
    cleartext: false,
  },
};

export default config;
