// Phase 1 of the controlled, server-side enquiry submission path (mission
// section 9). No photo bytes are sent here any more — see
// lib/data/enquiry-submission.ts for why, and app/api/enquiries/confirm
// for phase 2. Uses the service role deliberately (anonymous browsers have
// no direct database access to `enquiries`/`enquiry_images` at all — no
// RLS policy grants it) and validates everything itself before persisting
// anything.
import { NextResponse } from 'next/server';
import { isHoneypotTripped, parseBusinessSlug, parseEnquirySubmission } from '../../../lib/data/enquiry-validation';
import { EnquirySubmissionError, startEnquirySubmission } from '../../../lib/data/enquiry-submission';
import { checkRateLimit } from '../../../lib/rate-limit';
import { createServiceClient } from '../../../lib/supabase/service';

export async function POST(request: Request) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed } = await checkRateLimit(`enquiry:${clientIp}`);
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const record = body as Record<string, unknown>;

  // A tripped honeypot gets the same generic validation error a real
  // customer would see for a genuinely incomplete form — nothing here
  // signals to an automated client that it was detected.
  if (isHoneypotTripped(record)) {
    return NextResponse.json({ error: 'Complete the required details. "Not sure" is fine where offered.' }, { status: 400 });
  }

  const businessSlug = parseBusinessSlug(record);
  if (!businessSlug) return NextResponse.json({ error: 'Missing business.' }, { status: 400 });

  const parsed = parseEnquirySubmission(record);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let client;
  try {
    client = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'Enquiries are not available yet — this site is not fully configured.' }, { status: 503 });
  }

  try {
    const result = await startEnquirySubmission(client, { ...parsed.value, businessSlug });
    return NextResponse.json(result, { status: result.status === 'complete' ? 201 : 200 });
  } catch (error) {
    if (error instanceof EnquirySubmissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('enquiry submission failed', error);
    return NextResponse.json({ error: 'We could not save your enquiry. Your details are still here — please try again.' }, { status: 500 });
  }
}
