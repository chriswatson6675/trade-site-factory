// Controlled server-side enquiry submission path (mission section 9).
// Anonymous browsers have no direct database access to `enquiries` at all
// (no RLS policy grants it) — this route is the only way in, uses the
// service role key deliberately for that reason, and validates everything
// itself before persisting anything. Only a 201 with a reference means the
// enquiry (and any photos) were actually saved.
import { NextResponse } from 'next/server';
import { parseEnquiryFormData, readBusinessSlug } from '../../../lib/data/enquiry-validation';
import { allocateEnquiryReference } from '../../../lib/data/reference';
import { enquiryImagePath } from '../../../lib/data/storage-paths';
import { createServiceClient } from '../../../lib/supabase/service';

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form submission.' }, { status: 400 });
  }

  const slug = readBusinessSlug(formData);
  if (!slug) return NextResponse.json({ error: 'Missing business.' }, { status: 400 });

  const parsed = parseEnquiryFormData(formData);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let client;
  try {
    client = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'Enquiries are not available yet — this site is not fully configured.' }, { status: 503 });
  }

  const { data: business, error: businessError } = await client.from('businesses').select('id').eq('slug', slug).maybeSingle();
  if (businessError || !business) {
    return NextResponse.json({ error: 'Unknown business.' }, { status: 404 });
  }

  let reference: string;
  try {
    reference = await allocateEnquiryReference(client, business.id);
  } catch (error) {
    console.error('allocate_enquiry_reference failed', error);
    return NextResponse.json({ error: 'Could not allocate a reference. Please try again.' }, { status: 500 });
  }

  const value = parsed.value;
  const { data: enquiry, error: insertError } = await client
    .from('enquiries')
    .insert({
      business_id: business.id,
      reference,
      customer_name: value.customerName,
      mobile: value.mobile,
      email: value.email ?? null,
      location: value.location,
      preferred_contact: value.preferredContact ?? null,
      work_type: value.workType,
      storeys: value.storeys,
      access_areas: value.accessAreas,
      width: value.width,
      dimensions: value.dimensions ?? null,
      description: value.description,
      status: 'new',
    })
    .select('id')
    .single();

  if (insertError || !enquiry) {
    console.error('enquiry insert failed', insertError);
    return NextResponse.json({ error: 'We could not save your enquiry. Your details are still here — please try again.' }, { status: 500 });
  }

  // The enquiry itself is already durably saved at this point — a single
  // bad photo upload must not lose the customer's submission, so photo
  // failures are logged and skipped rather than failing the whole request.
  for (const file of value.photos) {
    try {
      const path = enquiryImagePath(business.id, enquiry.id, file.type);
      const { error: uploadError } = await client.storage.from('enquiry-images').upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: imageRowError } = await client.from('enquiry_images').insert({ enquiry_id: enquiry.id, business_id: business.id, storage_path: path });
      if (imageRowError) throw imageRowError;
    } catch (error) {
      console.error('enquiry photo upload failed', error);
    }
  }

  return NextResponse.json({ reference }, { status: 201 });
}
