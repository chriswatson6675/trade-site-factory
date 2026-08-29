# Supabase Auth setup — magic link template & redirect allow-list

One-time dashboard configuration required for passwordless owner sign-in
(and the claim-link handover flow) to work at all. Do this once the real
Trade Site Factory Supabase project exists.

## 1. Magic Link email template — EXACT text

Dashboard → **Authentication → Emails → Magic Link**. Replace the link in
the template body with exactly:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a>
```

### Why this exact form, and not `{{ .SiteURL }}/auth/confirm?...`

This app always calls `signInWithOtp({ email, options: { emailRedirectTo } })`
with `emailRedirectTo` already equal to the *complete* confirmation URL it
wants, including its own `next` destination — see
`components/sign-in-form.tsx`:

```
emailRedirectTo = "<current-origin>/auth/confirm?next=<encoded destination>"
```

Supabase exposes that exact value back to the template as `{{ .RedirectTo }}`.
Because it already contains a `?next=...` query string, appending
`&token_hash={{ .TokenHash }}&type=email` (with `&`, not `?`) produces one
well-formed URL: `.../auth/confirm?next=...&token_hash=...&type=email`,
which routes straight to this app's own `app/auth/confirm/route.ts` — on
whichever origin the visitor actually used (localhost, a Vercel preview,
or production), never a hardcoded one.

A template built from `{{ .SiteURL }}` instead of `{{ .RedirectTo }}` would
**silently discard** both the destination (`next`) *and* pick the wrong
origin for anything other than whatever single URL is configured as the
project's Site URL (breaking every Preview deployment, which each get a
unique hostname) — do not use that form.

## 2. Redirect URL allow-list

Dashboard → **Authentication → URL Configuration → Redirect URLs**.
Supabase rejects any `emailRedirectTo` whose origin isn't on this list.
Add every origin this app is ever served from — wildcards are supported
(`*` = one path segment, `**` = any number of segments):

| Environment | Entry |
|---|---|
| Local development | `http://localhost:3000/**` |
| Vercel Preview (every branch/PR deploy) | `https://*-chriswatson6675s-projects.vercel.app/**` (this Vercel team's account slug — confirm it still matches if the team/org ever changes) |
| Production | `https://<your-production-domain>/**` — add this **once a real domain is chosen and attached**; do not add it as, or leave it pointed at, the current temporary `trade-site-factory-*.vercel.app` preview hostname, which is not the permanent architecture |

## 3. Site URL

Dashboard → **Authentication → URL Configuration → Site URL**. Set to the
production domain once it exists (`http://localhost:3000` is fine before
then). This only affects Supabase's own default/fallback behaviour — the
actual redirect destination this app uses is always `{{ .RedirectTo }}`,
which is computed per-request (see §1), so an out-of-date Site URL does not
break sign-in.
