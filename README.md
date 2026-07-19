# My Family Dinner — Meal Planner

A single-file web app for browsing freezer-to-slow-cooker meals, planning weeks,
generating combined grocery lists, and following per-meal cooking instructions.
Everything is saved in your browser (localStorage) — no account or server needed.

## Files
- **index.html** — the whole app. That's it. Open it in a browser, or host it.

## Publish to GitHub Pages (no command line needed)
1. In your repo, click **Add file → Upload files** and drop in `index.html`.
   Click **Commit changes**.
2. Go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Set branch to **main** and folder to **/ (root)**, then **Save**.
5. Wait ~1 minute, refresh the Pages settings page, and your link appears at the top:
   `https://<your-username>.github.io/<your-repo>/`

## Update it later
Re-upload a new `index.html` (Add file → Upload files → Commit). Pages redeploys
automatically in a minute or two.

## Notes
- Data lives in the browser it's opened in, so weeks/ratings won't sync across
  devices. Clearing site data or using a different browser starts fresh.
- The app loads React and Babel from a CDN, so an internet connection is needed
  the first time it runs in a given browser.
