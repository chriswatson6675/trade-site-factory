// Phase 2 of the controlled, server-side enquiry submission path — see
// lib/data/enquiry-submission.ts. Called after the browser has attempted
// to upload every reserved photo directly to Storage using the signed
// upload URLs returned by phase 1 (POST /api/enquiries). This route does
// not trust that the uploads succeeded just because the client says so —
// it independently verifies each object exists before ever returning
// success, and rolls the enquiry back (with best-effort Storage cleanup)
// if any are missing. The enquiryId alone is not accepted as sufficient
// authorisation — the matching confirmationToken issued in phase 1 (a raw,
// high-entropy secret whose hash alone is stored) is required too.
import { NextResponse } from 'next/server';
import { confirmEnquirySubmission, EnquirySubmissionError } from '../../../../lib/data/enquiry-submission';
import { createServiceClient } from '../../../../lib/supabase/service';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const enquiryId = record.enquiryId;
  const confirmationToken = record.confirmationToken;
  if (typeof enquiryId !== 'string' || !enquiryId) {
    return NextResponse.json({ error: 'Missing enquiryId.' }, { status: 400 });
  }
  if (typeof confirmationToken !== 'string' || !confirmationToken) {
    return NextResponse.json({ error: 'Missing confirmationToken.' }, { status: 400 });
  }

  let client;
  try {
    client = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'Enquiries are not available yet — this site is not fully configured.' }, { status: 503 });
  }

  try {
    const result = await confirmEnquirySubmission(client, enquiryId, confirmationToken);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof EnquirySubmissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('enquiry confirmation failed', error);
    return NextResponse.json({ error: 'We could not confirm your enquiry. Please try again.' }, { status: 500 });
  }
}
