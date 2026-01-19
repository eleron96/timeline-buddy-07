# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Supabase setup (auth + workspaces)

This project uses Supabase for authentication, workspaces, and data storage.

Quick local start (single command, Docker Compose):

```sh
make up
```

This starts a local Supabase stack (db/auth/rest/functions/gateway) and the Vite frontend in separate containers.
Data is persisted in the `supabase_db_data` volume, so it survives frontend rebuilds and restarts.
On first run, `.env.compose` is generated automatically. You can edit it to set `RESEND_API_KEY` and `RESEND_FROM` for invites.
Keep `API_EXTERNAL_URL` set (default: `http://localhost:8080/auth/v1`) so auth links resolve correctly.

Stop everything (data preserved):

```sh
make down
```

Tail logs from all containers:

```sh
make logs
```

1) Create a Supabase project (Postgres).
2) Apply the schema from `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`).
3) Create `.env` from `.env.example` and fill:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4) Deploy the edge function for invites:
   - `supabase functions deploy invite`
   - Configure function env vars:
     - `APP_URL` (e.g. `http://localhost:5173`)
     - `RESEND_API_KEY` (optional, for sending magic links to existing users)
     - `RESEND_FROM` (e.g. `Workspace <no-reply@yourdomain.com>`)
5) Enable email auth in Supabase and configure SMTP if needed.

Notes:
- New users get a personal workspace automatically.
- Workspace membership is enforced with RLS.
- Users can belong to max 5 workspaces.
- Local Supabase data persists in Docker volumes unless you run `docker compose down -v` or delete volumes.
