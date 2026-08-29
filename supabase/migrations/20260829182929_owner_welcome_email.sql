-- BUILD-14 (TRADE-SITE-FACTORY-OWNER-HANDOFF-UX-14).
--
-- Adds durable, idempotent tracking of the post-claim welcome email (mission
-- section 4: "successful email marks delivery; subsequent normal page loads
-- do not resend it; ... owner/platform can safely retry email delivery;
-- retry does NOT require a new claim token").
--
-- welcome_email_sent_at lives on business_members rather than a new table —
-- it is a narrow, single-purpose delivery marker for exactly the
-- (business, owner) pair the email is about, and that row already exists
-- (created atomically by redeem_business_claim(), unchanged and untouched
-- by this migration) by the time the email is ever attempted.

alter table business_members add column welcome_email_sent_at timestamptz;

-- Marks the welcome email delivered for the caller's own membership row,
-- and only once: the `and welcome_email_sent_at is null` guard makes this
-- safe to call again (a no-op update, zero rows affected) even under a
-- concurrent retry, without needing a separate SELECT-then-UPDATE. Actually
-- sending the email happens in application code (lib/data/welcome-email.ts)
-- via the Resend HTTP API — Postgres has no business making outbound HTTP
-- calls for a one-off transactional email — this function only records that
-- it happened, after the fact, once the caller's own send attempt succeeded.
--
-- SECURITY DEFINER is required for the same reason as every other write
-- function here: there is deliberately no direct UPDATE policy on
-- business_members (see supabase/SECURITY.md — "no INSERT/UPDATE/DELETE
-- policy for anyone"), so a member can never grant themselves a different
-- role or backdate/forge another owner's delivery marker. This function is
-- the single narrow, audited exception, and it can only ever touch the
-- caller's own row (`user_id = auth.uid()`) for a business they already
-- belong to — it grants no new privilege over the row's `role` or any
-- other column, and does nothing at all for a business_id the caller isn't
-- a member of.
create or replace function mark_welcome_email_sent(p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row_count int;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.business_members
  set welcome_email_sent_at = now()
  where business_id = p_business_id
    and user_id = auth.uid()
    and welcome_email_sent_at is null;

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

revoke all on function mark_welcome_email_sent(uuid) from public;
revoke all on function mark_welcome_email_sent(uuid) from anon;
grant execute on function mark_welcome_email_sent(uuid) to authenticated;
