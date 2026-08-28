# Trade Site Factory MVP

A governed website factory for UK scaffolding businesses. The included fictional demo, Dee Valley Scaffolding Ltd, runs without credentials and demonstrates business editing, a generated public website, quote requests with browser-local image previews, WhatsApp hand-off, and an admin enquiry board.

## Run

`npm install`, then `npm run dev`. Open `/` for the public site and `/admin` for the demo admin. The demo is deliberately local-first: edits and enquiries are saved in browser local storage, so it can be reviewed without Supabase credentials.

## Architecture

The Next App Router UI has one governed scaffolding template. Structured business facts (services, areas, contact details and years trading) feed deterministic British-English copy; it does not invent claims. Public routes include `/`, `/services/[service]`, `/projects/[project]`, and `/quote`. Admin lives under `/admin`, with a private `/preview` route.

## Production data model

The production Supabase/PostgreSQL schema is in `supabase/schema.sql`: `users`, `businesses`, `services`, `business_services`, `service_areas`, `projects`, `project_images`, `testimonials`, `accreditations`, `site_configurations`, `enquiries`, `enquiry_images`, `generated_content`, and `audit_events`. Every tenant-owned record carries `business_id`; enforce this with RLS. Configure the optional Supabase keys in `.env.example`, then replace the local adapter with Supabase queries and Storage uploads.

## Delivery notes

WhatsApp uses normalised `wa.me` URLs and only opens a pre-filled messageâ€”nothing sends automatically. Quote form photos support phone camera capture and removal before submission. In a production Supabase deployment, public sites should be ISR-cached by business slug and draft/preview routes should send `noindex`; custom domains can later resolve to that slug.

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## Current limitation

This is a self-contained MVP demo rather than a configured Supabase deployment: authentication, durable PostgreSQL persistence, Storage upload, sitemap and per-record metadata are the next integration increment. No real business data or credentials are included.

