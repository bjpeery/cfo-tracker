# CFO Project Command — Setup Guide

Everything you need to go from these files to a live URL accessible from any device.
Total time: ~45 minutes.

---

## What you're building

- **Frontend**: React + Vite app (the tracker UI)
- **Database**: Supabase (free tier — Postgres in the cloud)
- **Hosting**: Vercel (free tier — auto-deploys on every git push)

---

## Step 1 — Set up Supabase (your database)

1. Go to https://supabase.com and create a free account.
2. Click **New Project**. Give it a name (e.g. "cfo-tracker"). Set a strong DB password and save it somewhere.
3. Wait ~2 minutes for the project to spin up.
4. In the left sidebar, click **SQL Editor**, then **New Query**.
5. Paste and run this SQL to create your two tables:

```sql
-- Projects table
create table projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  due_date    date,
  priority    text not null default 'High',
  status      text not null default 'In Progress',
  partners    text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Reminders table
create table reminders (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  email       text not null,
  days_before integer not null default 3,
  created_at  timestamptz default now()
);

-- Allow public read/write (since this is a private personal tool)
alter table projects  enable row level security;
alter table reminders enable row level security;

create policy "Allow all" on projects  for all using (true) with check (true);
create policy "Allow all" on reminders for all using (true) with check (true);
```

6. In the left sidebar, go to **Settings → API**.
7. Copy your **Project URL** and **anon/public key** — you'll need these in Step 3.

---

## Step 2 — Set up the project locally

You'll need Node.js installed (https://nodejs.org — use the LTS version).

```bash
# 1. Put all these files into a folder called cfo-tracker
#    (they should already be structured correctly)

# 2. Open a terminal in that folder, then install dependencies
npm install

# 3. Copy the env template
cp .env.example .env
```

Open `.env` in any text editor and fill in your values from Supabase:

```
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
```

```bash
# 4. Run locally to verify everything works
npm run dev
```

Open http://localhost:5173 — you should see the tracker. Try adding a project; it should persist after refresh.

---

## Step 3 — Deploy to Vercel (get your public URL)

1. Push your project to GitHub:
   - Create a new **private** repo at https://github.com/new
   - Follow GitHub's instructions to push your local folder

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/cfo-tracker.git
   git push -u origin main
   ```

2. Go to https://vercel.com and sign in with GitHub.
3. Click **Add New → Project** and import your `cfo-tracker` repo.
4. Vercel will auto-detect it as a Vite project. Before clicking Deploy, go to **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**.

In ~60 seconds you'll get a URL like `https://cfo-tracker-xyz.vercel.app`.
Open it on your phone, laptop, anywhere — all data is shared via Supabase.

---

## Step 4 — Custom domain (optional)

In Vercel → your project → **Settings → Domains**, you can add a custom domain like `projects.yourcompany.com` if you have one.

---

## Ongoing use

- **To update the app**: edit the code locally, commit, and push to GitHub. Vercel redeploys automatically in ~30 seconds.
- **To view your data directly**: Supabase Dashboard → Table Editor → `projects`.
- **Backups**: Use the Export → Excel button in the app, or set up Supabase's built-in scheduled backups (free tier includes daily backups).

---

## File structure recap

```
cfo-tracker/
├── index.html              # HTML shell
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies
├── .env.example            # Env template (safe to commit)
├── .env                    # Your actual secrets (DO NOT commit)
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Main tracker component
    └── supabaseClient.js   # Supabase connection
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page / "missing credentials" error | Check `.env` values match Supabase exactly |
| Projects not saving | Check Supabase SQL Editor ran without errors; confirm RLS policies exist |
| Vercel build fails | Make sure env variables are set in Vercel dashboard, not just locally |
| Can't access from phone | Make sure you're using the Vercel URL, not localhost |
