// Minimal, dependency-free Resend HTTP integration (mission section 3:
// "prefer a minimal direct Resend HTTP integration ... rather than
// overbuilding an email subsystem"). Server-only — NEVER import this from a
// 'use client' file or a browser bundle; RESEND_API_KEY must never reach
// the browser.
const RESEND_API_URL = 'https://api.resend.com/emails';

/** Thrown when RESEND_API_KEY is missing. Callers treat this as a normal,
 * loggable failure — not a reason to undo anything already committed (an
 * ownership claim, in particular; see lib/data/welcome-email.ts). */
export class EmailNotConfiguredError extends Error {}

function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailNotConfiguredError('RESEND_API_KEY is not set.');
  return key;
}

/** Preview default matches mission section 3's suggested Resend development sender. */
function getFromAddress(): string {
  return process.env.OWNER_EMAIL_FROM || 'Trade Site Builder <onboarding@resend.dev>';
}

export type SendEmailInput = { to: string; subject: string; html: string; text: string };

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('sendEmail() must never be called in the browser.');
  }
  const apiKey = getResendApiKey();

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    // Never log the API key or the raw response body verbatim beyond a
    // short, bounded slice — it could echo back request details.
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend API error (${response.status}): ${detail.slice(0, 300)}`);
  }
}
