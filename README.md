# Hysteroscopy rating

A blinded rating tool. Three physicians read emergency-room admission notes, with ultrasound findings where there are any, and rate, for each case and in two separate steps, who should perform the hysteroscopy: **junior specialist (מומחה צעיר)** or **senior specialist (מומחה ותיק)**. Step 1 is entering the uterine cavity (diagnostic hysteroscopy); step 2 is the operative procedure (operative hysteroscopy), which can also be rated **not applicable (לא רלוונטי)** when no operative step is needed. The admin uploads case files in the app, renames or deletes them, sees all ratings, agreement statistics and disputed cases per file, and exports an Excel file and a PDF report.

**Stack:** Next.js 16 (App Router) on Render · Supabase (Postgres, magic-link auth, Row Level Security) · a Python script that creates the user accounts.

## How blinding is enforced

Blinding is enforced in the database, not just hidden in the UI:

- Every table has **Row Level Security**. A reviewer's queries return only that reviewer's own ratings. Another reviewer's rating can't be read, written or inferred through the API.
- Roles live in `profiles`, which no user can modify. The admin can read everything but can't rate.
- Signed-out visitors get no access at all. Sign-in uses a magic link, and only for accounts the admin created (`shouldCreateUser: false` plus sign-ups disabled in Supabase).
- Every rating change is written to an append-only audit table (`rating_events`) that only the admin can read.
- The annotation columns of an uploaded file (age, pathology type and so on) live in an admin-only table. Reviewers rate from the admission note and ultrasound findings only.
- Only the admin can rename or delete a file. Deleting removes its cases and their ratings for everyone; the audit trail keeps the ratings and records the deletion.
- Uploads go through a database function that checks the admin role itself, so the app never holds the secret key.

`npm run test:db` runs 61 checks against the real migrations, including the upgrade of existing data, on an in-memory Postgres (PGlite) to prove the points above.

## What's kept out of git

This repo is public, so it holds **no patient data, no names, no emails and no keys**:

| Kept locally, never committed | Purpose |
|---|---|
| `.env.local` | Supabase URL + publishable key for local dev |
| `scripts/.env` | Secret key + the admin/reviewer emails and names |
| `data/` (and any `.xlsx`, `.csv`, `.pdf`) | The cases spreadsheet and exports |

The `.example` files show the variable names. The admission texts must be **de-identified** before import.

## Setup

### 1. Supabase

1. Create a project in an **EU region** (for example Frankfurt).
2. **SQL Editor** → paste and run each file in `supabase/migrations/`, in order.
3. **Authentication → Sign In / Providers**: turn off *Allow new users to sign up*. Keep Email enabled.
4. **Authentication → URL Configuration**: set *Site URL* to your Render URL, and add `http://localhost:3000/**` and `https://<your-app>.onrender.com/**` to *Redirect URLs*.
5. **Authentication → Emails → Magic Link** template: replace the link with
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">כניסה למערכת</a>
   ```
   This lets the link work even if a doctor opens it on a different device than the one they requested it from.
6. **Authentication → Emails → SMTP Settings**: set up a custom SMTP provider (for example Resend or SendGrid). Supabase's built-in mailer only sends to the project's own team members and is heavily rate-limited, so reviewers won't get their links without this.
7. **Project Settings → API Keys**: copy the *publishable* key and the *secret* key.

### 2. Local setup

```bash
npm install
cp .env.example .env.local            # URL + publishable key
cp scripts/.env.example scripts/.env  # URL + secret key + people

python -m venv .venv
.venv\Scripts\activate                # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r scripts/requirements.txt
```

### 3. Accounts (one time)

```bash
python scripts/create_users.py
```

Cases are uploaded by the admin in the app, on the **קבצים** page (see below).

### 4. Run and deploy

```bash
npm run dev        # http://localhost:3000
```

On **Render**, choose **New → Blueprint**, connect this GitHub repo, and Render reads `render.yaml`: one free web service in Frankfurt, auto-deployed on every push to `main`. It asks for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` once. **Never** put the secret key in Render: the app doesn't need it. Node is pinned to 22 in `.node-version`.

On the free plan the service sleeps after 15 minutes without visitors, and the next visit takes about a minute to wake it. No data is lost, since all data lives in Supabase.

## Using it

**Reviewer** (`/review`)
- When there is more than one file, you first choose which file to work on, by the name the admin gave it. Each file has its own progress, and you can switch files at any time.
- Each case is two cards in a row, marked *שלב 1 מתוך 2* (entering the uterine cavity) and *שלב 2 מתוך 2* (the operative procedure), both showing the admission note with its ultrasound findings. Swipe a card **right for מומחה צעיר** or **left for מומחה ותיק**. The buttons under the card and the right / left arrow keys do the same. The operative card also has **לא רלוונטי** (button or down arrow). Click **הבא** to skip a card for now.
- Every click saves immediately. Next time you sign in, you resume after the last card you touched, and you only get cards you haven't rated yet. Skipped cards come back around. Progress counts ratings: two per case.
- **הדירוגים שלי** lists your ratings, by file, with both steps of each case side by side. **עריכה** opens that step's card to rate it again; **הסרה** removes that one rating. A rated card also has **הסרה** next to your current rating. A removed rating goes back into your queue, and the removal is kept in the audit log.
- The moon / sun button in the header switches between light and dark mode. Until you choose, the app follows your system setting.

**Admin** (`/admin`)
- **קבצים**: upload a new case file (`.xlsx` or `.csv`), rename a file, or delete it. Reviewers see every file; a file disappears for them only when it is deleted. Deleting asks you to type the file name, and removes its cases and all their ratings. Every file has the same structure: patient serial number, admission text and ultrasound findings in the first three columns, then any annotation columns. The upload picks the sheet with the cases (skipping legend or lookup sheets), treats `0` in the ultrasound column as "no ultrasound" by default, reads Hebrew CSV files saved by Excel in either UTF-8 or Windows-1255, and stops with a list of problem rows (missing serial number, missing admission text, duplicate serial number) without saving anything.
- Every admin page has a file selector when there is more than one file. The dashboard can also rename the file it shows.
- Dashboard: overall progress, then a section per step: per-reviewer distribution, Fleiss' kappa (all three reviewers), pairwise Cohen's kappa, and majority decisions. Each step is analysed with its own answer options as categories.
- **כל הקבלות**: the full table with filters (disputed, incomplete, not rated, complete). A step is *disputed* when it has at least two ratings that differ; a case is disputed when either step is.
- **ייצוא לאקסל**: a right-to-left Excel sheet, one row per case: each reviewer's rating for each step, the majority and a disputed flag per step, the number of ratings, the admission text and ultrasound findings the reviewers saw, then every annotation column from the source spreadsheet in its original order. Frozen header row, wrapped text, and colour-coded ratings.
- **דוח PDF**: a printable report. Click *הורדה כ-PDF* and choose *Save as PDF*. The browser renders Hebrew right-to-left correctly, which server-side PDF libraries don't do reliably.

## Development

```bash
npm test          # statistics, export and file-parsing unit tests
npm run test:db   # Row Level Security tests
npm run lint
npm run build
```

Statistics references: Cohen (1960) *Educ Psychol Meas* 20:37-46 · Fleiss (1971) *Psychol Bull* 76:378-382 · Landis & Koch (1977) *Biometrics* 33:159-174.
