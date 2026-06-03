# Hebomb Training Tracker

Mobile-first workout tracker. Lives at hebomb.com via GitHub Pages.
Data stored in Google Sheets via Apps Script.

---

## STEP 1 — Google Sheet Setup (~10 min)

1. Go to [sheets.google.com](https://sheets.google.com) → create a new blank spreadsheet
2. Name it **"Hebomb Workout Log"**
3. Go to **Extensions → Apps Script**
4. Delete all existing code
5. Copy the entire contents of `Code.gs` and paste it in
6. Click **Save** (floppy disk or Ctrl+S)
7. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** → copy the Web App URL (looks like `https://script.google.com/macros/s/AKfy.../exec`)

---

## STEP 2 — GitHub Repo Setup (~5 min)

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `hebomb` (or anything you like)
3. Upload all files from this folder:
   - `index.html`
   - `manifest.json`
   - `js/config.js`
   - `js/program.js`
   - `js/app.js`
   - `js/ui.js`
   - `Code.gs` (for reference — not served, just stored)
4. Go to **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main`, folder: `/ (root)`
5. Click **Save** — GitHub will give you a `username.github.io/hebomb` URL

---

## STEP 3 — Paste Your Apps Script URL

1. Open `js/config.js` in GitHub (click the file → pencil icon to edit)
2. Replace `YOUR_APPS_SCRIPT_URL_HERE` with the URL from Step 1
3. Commit the change

---

## STEP 4 — Point hebomb.com to GitHub Pages (~5 min)

In your domain registrar (where hebomb.com is registered):

**Add a CNAME record:**
```
Type:  CNAME
Name:  www
Value: yourgithubusername.github.io
```

**For apex domain (hebomb.com without www), add these A records:**
```
Type: A  →  185.199.108.153
Type: A  →  185.199.109.153
Type: A  →  185.199.110.153
Type: A  →  185.199.111.153
```

Back in GitHub → Settings → Pages → Custom domain → type `hebomb.com` → Save.
Check "Enforce HTTPS" once it propagates (can take up to 24 hrs, usually under 1 hr).

---

## STEP 5 — Install as App on iPhone

1. Open hebomb.com in Safari
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Name it "Hebomb" → Add

It'll open full-screen like a native app. No App Store needed.

---

## Updating Your Program

To change weights, add exercises, etc.:
- Edit `js/program.js` directly in GitHub
- Changes go live in ~30 seconds

---

## Your Data

All workout history lives in the Google Sheet "Hebomb Workout Log".
- **WorkoutLog** tab: every set ever logged
- **Meta** tab: last session per day type

You can open the Sheet anytime to see raw data, export to CSV, or share with a trainer.

---

## Local-Only Mode

If you haven't set up Google Sheets yet, the app still works fully —
data is saved to your browser's localStorage. Just paste the Apps Script
URL into `config.js` when ready and it'll switch over automatically.
