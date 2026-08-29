// Server-side validation for POST /api/enquiries. The client (PhotoPicker,
// validEnquiry in lib/domain) already validates for UX, but a request can
// always bypass the browser, so this is the real source of truth.
import { imageSizeValid, imageTypeValid } from '../domain/index.ts';

export type ParsedEnquiryInput = {
  customerName: string;
  mobile: string;
  email?: string;
  location: string;
  preferredContact?: string;
  workType: string;
  storeys: string;
  accessAreas: string;
  width: string;
  dimensions?: string;
  description: string;
  photos: File[];
};

export type EnquiryValidationResult =
  | { ok: true; value: ParsedEnquiryInput }
  | { ok: false; error: string };

const MAX_PHOTOS = 6;

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

export function parseEnquiryFormData(formData: FormData): EnquiryValidationResult {
  const businessSlug = text(formData, 'businessSlug');
  const customerName = text(formData, 'name');
  const mobile = text(formData, 'mobile');
  const email = text(formData, 'email');
  const location = text(formData, 'location');
  const preferredContact = text(formData, 'preferredContact');
  const workType = text(formData, 'work');
  const storeys = text(formData, 'storeys');
  const accessAreas = text(formData, 'access');
  const width = text(formData, 'width');
  const dimensions = text(formData, 'dimensions');
  const description = text(formData, 'description');

  if (!businessSlug) return { ok: false, error: 'Missing business.' };
  if (!customerName || !mobile || !location || !workType || !storeys || !accessAreas || !width || !description) {
    return { ok: false, error: 'Complete the required details. "Not sure" is fine where offered.' };
  }

  const photos = formData.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (photos.length > MAX_PHOTOS) {
    return { ok: false, error: `You can add up to ${MAX_PHOTOS} photos.` };
  }
  const invalidType = photos.find((file) => !imageTypeValid(file));
  if (invalidType) return { ok: false, error: `${invalidType.name} is not an image.` };
  const invalidSize = photos.find((file) => !imageSizeValid(file));
  if (invalidSize) return { ok: false, error: `${invalidSize.name} is larger than 10 MB.` };

  return {
    ok: true,
    value: {
      customerName,
      mobile,
      email: email || undefined,
      location,
      preferredContact: preferredContact || undefined,
      workType,
      storeys,
      accessAreas,
      width,
      dimensions: dimensions || undefined,
      description,
      photos,
    },
  };
}

export function readBusinessSlug(formData: FormData): string {
  const value = formData.get('businessSlug');
  return typeof value === 'string' ? value.trim() : '';
}
