'use client';
import { FormEvent, useState } from 'react';
import type { Business, Enquiry } from '../lib/data/types';
import { validEnquiry, whatsAppUrl } from '../lib/domain';
import { PhotoItem, PhotoPicker } from './photo-picker';

export type EnquiryDraft = Partial<Omit<Enquiry, 'id' | 'businessId' | 'reference' | 'photos' | 'status'>>;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode };
const Button = ({ children, ...props }: ButtonProps) => (
  <button className="btn" {...props}>
    {children}
  </button>
);

type Props = {
  business: Business;
  onSubmit: (draft: EnquiryDraft, photos: PhotoItem[], honeypot: string) => Promise<{ reference: string }>;
};

/** Production quote form — posts through onSubmit (see components/production-quote-form.tsx → POST /api/enquiries). Demo mode keeps its own inline copy inside components/completion-app.tsx unchanged. */
export function QuoteForm({ business, onSubmit }: Props) {
  const [form, setForm] = useState<EnquiryDraft>({ preferredContact: 'Phone' });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  // Honeypot: invisible to a real visitor, filled in only by unattended bots that populate every field. A non-empty value is checked server-side too.
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const update = (key: keyof EnquiryDraft, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!validEnquiry(form as Partial<Enquiry>)) {
      setError('Complete the required details. “Not sure” is fine where offered.');
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit(form, photos, website);
      setReference(result.reference);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not save your enquiry. Your details are still here—please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (reference)
    return (
      <main className="form-page success-page">
        <p className="eyebrow">Enquiry sent</p>
        <h1>Thanks — we’ve got it</h1>
        <p>
          Your enquiry and {photos.length} photo{photos.length === 1 ? '' : 's'} have been sent to {business.name}.
        </p>
        <b className="ref">{reference}</b>
        <a
          className="btn"
          target="_blank"
          rel="noreferrer"
          href={whatsAppUrl(business.whatsapp, `Hi, I’ve just submitted quote request ${reference} through your website.`)}
        >
          CONTINUE ON WHATSAPP
        </a>
      </main>
    );

  const choices = [
    ['work', 'What is the work for?', ['Roofing', 'Chimney', 'Rendering', 'Painting', 'Windows', 'Extension', 'Solar', 'New build', 'Other', 'Not sure']],
    ['storeys', 'Storeys / property height', ['Bungalow', '2 storeys', '3 storeys', '4+', 'Not sure']],
    ['access', 'Access required', ['Front', 'Rear', 'Left', 'Right', 'Whole property', 'Not sure']],
    ['width', 'Approximate width', ['Under 5m', '5–10m', '10–20m', '20m+', 'Not sure']],
  ] as const;

  return (
    <main className="form-page">
      <p className="eyebrow">Request a quote</p>
      <h1>Tell us about the job.</h1>
      <p>You don’t need to know scaffolding terminology.</p>
      <form onSubmit={submit}>
        <div style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
          <label htmlFor="website">Leave this field blank</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </div>
        <fieldset>
          <legend>Your details</legend>
          <label>
            Name*
            <input value={form.name || ''} onChange={(event) => update('name', event.target.value)} />
          </label>
          <label>
            Mobile*
            <input type="tel" value={form.mobile || ''} onChange={(event) => update('mobile', event.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={form.email || ''} onChange={(event) => update('email', event.target.value)} />
          </label>
          <label>
            Postcode or location*
            <input value={form.location || ''} onChange={(event) => update('location', event.target.value)} />
          </label>
          <label>
            Preferred contact method
            <select value={form.preferredContact} onChange={(event) => update('preferredContact', event.target.value)}>
              <option>Phone</option>
              <option>WhatsApp</option>
              <option>Email</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>About the work</legend>
          {choices.map(([key, label, options]) => (
            <label key={key}>
              {label}*
              <select value={String(form[key] || '')} onChange={(event) => update(key, event.target.value)}>
                <option value="">Choose…</option>
                {options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Optional dimensions
            <input value={form.dimensions || ''} placeholder="e.g. 8m wide" onChange={(event) => update('dimensions', event.target.value)} />
          </label>
          <label>
            Description*
            <textarea rows={4} value={form.description || ''} onChange={(event) => update('description', event.target.value)} />
          </label>
        </fieldset>
        <fieldset>
          <legend>Customer photos</legend>
          <p>Photos help us understand the job. If possible include the front of the property, access route and area needing work.</p>
          <PhotoPicker images={photos} onChange={setPhotos} />
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'SENDING…' : 'SEND QUOTE REQUEST'}
        </Button>
      </form>
    </main>
  );
}
