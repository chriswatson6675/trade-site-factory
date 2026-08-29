// Node-only (uses node:crypto) — used by scripts/create-claim-link.ts. Never
// import this from a 'use client' file or any code that ships to the
// browser: a raw claim token must only ever exist transiently, in the
// Founder's terminal and the link they send — never in a request/response
// body, never in application code, never in the database (only its hash is
// stored, in business_claims.token_hash).
import { createHash, randomBytes } from 'node:crypto';

/** A new random, unguessable claim token (raw — shown once, never persisted). */
export const generateClaimToken = (): string => randomBytes(32).toString('base64url');

/** SHA-256 hex digest — the only form ever persisted, matching redeem_business_claim()'s `encode(digest(p_token, 'sha256'), 'hex')` in supabase/migrations/20260829120300_rls_policies.sql. */
export const hashClaimToken = (token: string): string => createHash('sha256').update(token).digest('hex');
