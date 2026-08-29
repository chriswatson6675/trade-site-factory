# Trade Site Factory MVP

A governed website factory for UK scaffolding businesses. The included fictional demo, Dee Valley Scaffolding Ltd, runs without credentials and demonstrates business editing, a generated public website, quote requests with browser-local image previews, WhatsApp hand-off, and an admin enquiry board.

## Run

`npm install`, then `npm run dev`. Open `/` for the public site and `/admin` for the demo admin. The demo is deliberately local-first: edits and enquiries are saved in browser local storage, so it can be reviewed without Supabase credentials.

## Architecture

The Next App Router UI has one governed scaffolding template. Structured business facts (services, areas, contact details and years trading) feed deterministic British-English copy; it does not invent claims. Public routes include `/`, `/services/[service]`, `/projects/[project]`, and `/quote`. Admin lives under `/admin`, with a private `/preview` route.

## Production data model

The real, applied-in-order schema is the migration chain in `supabase/migrations/` (not `supabase/schema.sql`, which is superseded and kept only for historical reference). It covers `businesses`, `business_members`, `business_claims`, `services`, `business_services`, `service_areas`, `projects`, `project_images`, `testimonials`, `accreditations`, `site_configurations`, `enquiries` (with a `pending`/`confirmed` submission state), `enquiry_images`, `enquiry_confirmation_tokens`, and `enquiry_counters`. Every tenant-owned record carries `business_id`, enforced by Row Level Security — see `supabase/SECURITY.md` for the full policy/function audit. Configure the Supabase keys in `.env.example`, then see `supabase/AUTH_SETUP.md` for the one-time Supabase Auth dashboard configuration (magic link email template, redirect URL allow-list) required for owner sign-in to work.

## Delivery notes

WhatsApp uses normalised `wa.me` URLs and only opens a pre-filled message — nothing sends automatically. Quote form photos upload directly to Supabase Storage from the browser (never proxied through a server function); public site pages read fresh from Supabase on every request (`force-dynamic`), so publishing or editing content updates the live site with no redeploy.

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## Current limitation

No Trade Site Factory Supabase project has been created yet — this repo is a fully-built, unit-tested migration chain and application layer, pending the Founder completing the one-time setup in `supabase/AUTH_SETUP.md` and applying the migrations. Until then the app runs in local demo mode (browser-local storage, seeded fictional data) with no credentials required. `lib/rate-limit.ts` is a documented no-op seam, not real abuse protection — add a real limiter/Turnstile before broad public launch.

