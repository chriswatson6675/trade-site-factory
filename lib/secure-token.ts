// Node-only (uses node:crypto). Shared by every one-time, hashed,
// server-issued secret in this app: business claim tokens
// (scripts/create-claim-link.ts) and enquiry confirmation tokens
// (lib/data/enquiry-submission.ts). Never import this from a 'use client'
// file — a raw token must only ever exist transiently (in the server
// response that issues it, and in the browser's in-memory state until it's
// sent back once); the database only ever stores its SHA-256 hash.
import { createHash, randomBytes } from 'node:crypto';

/** A new random, unguessable token (raw — shown/returned once, never persisted). */
export const generateSecureToken = (): string => randomBytes(32).toString('base64url');

/**
 * SHA-256 hex digest — the only form ever persisted. Must match the
 * corresponding SQL side exactly: `encode(extensions.digest(p_token, 'sha256'), 'hex')`
 * in supabase/migrations/20260829120300_rls_policies.sql
 * (redeem_business_claim and confirm_pending_enquiry).
 */
export const hashSecureToken = (token: string): string => createHash('sha256').update(token).digest('hex');
