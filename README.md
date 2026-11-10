# Hysteroscopy rating

A blinded rating tool. Three physicians read emergency-room admission notes, with ultrasound findings where there are any, and rate who should perform the hysteroscopy: **resident (מתמחה)** or **specialist (מומחה)**. An admin sees all ratings, agreement statistics and disputed cases, and exports a CSV and a PDF report.

**Stack:** Next.js 16 (App Router) on Vercel · Supabase (Postgres, magic-link auth, Row Level Security) · Python scripts for the one-time setup.

## How blinding is enforced

Blinding is enforced in the database, not just hidden in the UI:

- Every table has **Row Level Security**. A reviewer's queries return only that reviewer's own ratings. Another reviewer's rating can't be read, written or inferred through the API.
- Roles live in `profiles`, which no user can modify. The admin can read everything but can't rate.
- Signed-out visitors get no access at all. Sign-in uses a magic link, and only for accounts the admin created (`shouldCreateUser: false` plus sign-ups disabled in Supabase).
- Every rating change is written to an append-only audit table (`rating_events`) that only the admin can read.

`npm run test:db` runs 22 checks against the real migration on an in-memory Postgres (PGlite) to prove the points above.

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
2. **SQL Editor** → paste and run `supabase/migrations/0001_init.sql`.
3. **Authentication → Sign In / Providers**: turn off *Allow new users to sign up*. Keep Email enabled.
4. **Authentication → URL Configuration**: set *Site URL* to your Vercel URL, and add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**` to *Redirect URLs*.
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

### 3. Accounts and cases (one time)

```bash
python scripts/create_users.py

# Put the Excel in data/ (git-ignored). Check the mapping first:
python scripts/import_cases.py data/cases.xlsx --dry-run
# If the first three columns aren't serial / admission / ultrasound, name them:
python scripts/import_cases.py data/cases.xlsx --id-col "..." --admission-col "..." --us-col "..."
```

The import never overwrites an existing case, so ratings always stay attached to the exact text the reviewer saw. Rows with a missing serial number, a missing admission text or a duplicate serial number stop the import and get listed for you to fix.

### 4. Run and deploy

```bash
npm run dev        # http://localhost:3000
```

On **Vercel**, import the GitHub repo and set only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Never** put the secret key in Vercel: the app doesn't need it.

## Using it

**Reviewer** (`/review`)
- Each screen shows one admission note and its ultrasound findings. Click **מתמחה** or **מומחה**, or press `1` / `2`. Click **הבא**, or press `←` or `N`, to skip a case for now.
- Every click saves immediately. Next time you sign in, you resume after the last case you touched, and you only get cases you haven't rated yet. Skipped cases come back around.
- **הדירוגים שלי** lists your ratings. Open any of them to change it.

**Admin** (`/admin`)
- Dashboard: progress, cases not rated yet, per-reviewer distribution, Fleiss' kappa (all three reviewers), pairwise Cohen's kappa, and majority decisions.
- **כל הקבלות**: the full table with filters (disputed, incomplete, not rated, complete). A case is *disputed* when it has at least two ratings that differ.
- **ייצוא CSV**: one row per case with all three ratings, the majority and a disputed flag. UTF-8 with BOM, so Hebrew opens correctly in Excel, and cells are protected against formula injection.
- **דוח PDF**: a printable report. Click *הורדה כ-PDF* and choose *Save as PDF*. The browser renders Hebrew right-to-left correctly, which server-side PDF libraries don't do reliably.

## Development

```bash
npm test          # statistics + CSV unit tests
npm run test:db   # Row Level Security tests
npm run lint
npm run build
```

Statistics references: Cohen (1960) *Educ Psychol Meas* 20:37-46 · Fleiss (1971) *Psychol Bull* 76:378-382 · Landis & Koch (1977) *Biometrics* 33:159-174.
