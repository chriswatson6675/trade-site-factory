/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { OwnerAdapter } from '../lib/data/owner-adapter';
import type { Business, Enquiry, Project, Status } from '../lib/data/types';
import { canTransition, whatsAppUrl } from '../lib/domain';
import { PhotoItem, PhotoPicker } from './photo-picker';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode };
const Button = ({ children, ...props }: ButtonProps) => (
  <button className="btn" {...props}>
    {children}
  </button>
);
const Back = ({ onClick }: { onClick: () => void }) => (
  <button className="back" type="button" onClick={onClick}>
    ← Back
  </button>
);

type View = 'home' | 'add' | 'jobs' | 'edit' | 'details' | 'enquiries' | 'live';

type Props = {
  mode: 'demo' | 'supabase';
  adapter: OwnerAdapter;
  initialBusiness: Business;
  initialProjects: Project[];
  initialEnquiries: Enquiry[];
  /** Permanent customer-facing website URL — already resolved (custom domain preferred, falling back to /sites/<slug>) by app/owner/page.tsx via lib/site-url.ts. Never build a /sites/<slug> URL directly in this file. */
  publicSiteUrl: string;
};

export function OwnerApp({ mode, adapter, initialBusiness, initialProjects, initialEnquiries, publicSiteUrl }: Props) {
  const [business, setBusiness] = useState(initialBusiness);
  const [projects, setProjects] = useState(initialProjects);
  const [enquiries, setEnquiries] = useState(initialEnquiries);
  const [view, setView] = useState<View>('home');
  const [selected, setSelected] = useState<Project | null>(null);
  const [draft, setDraft] = useState<{ service: string; location: string; description: string }>({
    service: business.services[0] || 'Other',
    location: '',
    description: '',
  });
  const [draftPhotos, setDraftPhotos] = useState<PhotoItem[]>([]);
  const [editPhotos, setEditPhotos] = useState<PhotoItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const saveBusiness = async (next: Business) => {
    setBusy(true);
    setError('');
    try {
      await adapter.saveBusiness(next);
      setBusiness(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your business details.');
    } finally {
      setBusy(false);
    }
  };

  const startAdd = () => {
    setDraft({ service: business.services[0] || 'Other', location: '', description: '' });
    setDraftPhotos([]);
    setError('');
    setView('add');
  };

  const publish = async () => {
    if (!draft.location.trim()) {
      setError('Add the town or location before publishing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const project = await adapter.publishProject({
        service: draft.service,
        location: draft.location.trim(),
        description: draft.description.trim(),
        photos: draftPhotos,
      });
      setProjects([project, ...projects]);
      setSelected(project);
      setView('live');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish this job. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (project: Project) => {
    setSelected(project);
    setDraft({ service: project.service, location: project.location, description: project.description });
    setEditPhotos(project.images.map((url) => ({ url })));
    setError('');
    setView('edit');
  };

  const saveEdit = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const updated = await adapter.updateProject(selected, {
        service: draft.service,
        location: draft.location,
        description: draft.description,
        photos: editPhotos,
      });
      setProjects(projects.map((item) => (item.id === updated.id ? updated : item)));
      setView('jobs');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this job. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const updated = await adapter.setProjectPublished(selected, !selected.published);
      setProjects(projects.map((item) => (item.id === updated.id ? updated : item)));
      setView('jobs');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this job. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm('Delete this job?')) return;
    setBusy(true);
    setError('');
    try {
      await adapter.deleteProject(selected);
      setProjects(projects.filter((item) => item.id !== selected.id));
      setView('jobs');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this job. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const changeEnquiryStatus = async (enquiry: Enquiry, status: Status) => {
    setError('');
    try {
      await adapter.updateEnquiryStatus(enquiry, status);
      setEnquiries(enquiries.map((item) => (item.id === enquiry.id ? { ...item, status } : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this enquiry.');
    }
  };

  if (view === 'add')
    return (
      <OwnerPage mode={mode} error={error} publicSiteUrl={publicSiteUrl}>
        <Back onClick={() => setView('home')} />
        <h1>Add today’s job</h1>
        <p>Just the facts. Your website handles the rest.</p>
        <section className="owner-card">
          <label>
            1. What did you do today?
            <select value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value })}>
              {[...new Set([...business.services, 'Other'])].map((service) => (
                <option key={service}>{service}</option>
              ))}
            </select>
          </label>
          <label>
            2. Where was the job?
            <input value={draft.location} placeholder="e.g. Wrexham" onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
          </label>
          <div>
            <h2>3. Add photos</h2>
            <PhotoPicker images={draftPhotos} onChange={setDraftPhotos} />
          </div>
          <label>
            4. What did you do? <small>(optional)</small>
            <textarea
              rows={4}
              value={draft.description}
              placeholder="e.g. Two-storey access scaffold completed in Wrexham."
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
          <Button type="button" disabled={busy} onClick={publish}>
            {busy ? 'PUBLISHING…' : 'PUBLISH JOB'}
          </Button>
        </section>
      </OwnerPage>
    );

  if (view === 'live' && selected)
    return (
      <OwnerPage mode={mode} extra="success-page" publicSiteUrl={publicSiteUrl}>
        <h1>Your job is live</h1>
        <p>It now appears automatically on your website.</p>
        <Link className="btn" href={`/sites/${business.slug}/projects/${selected.slug}`}>
          VIEW IT
        </Link>
        <button className="btn outline" onClick={startAdd}>
          ADD ANOTHER JOB
        </button>
        <button className="back" onClick={() => setView('home')}>
          Back to your website controls
        </button>
      </OwnerPage>
    );

  if (view === 'jobs')
    return (
      <OwnerPage mode={mode} error={error} publicSiteUrl={publicSiteUrl}>
        <Back onClick={() => setView('home')} />
        <h1>My jobs</h1>
        <div className="job-list">
          {projects.map((project) => (
            <button className="job-row" key={project.id} onClick={() => startEdit(project)}>
              {project.images[0] ? <img src={project.images[0]} alt="" /> : <span className="job-placeholder" />}
              <span>
                <b>
                  {project.published ? 'LIVE' : 'DRAFT'} · {project.title}
                </b>
                <small>
                  {project.location} · {project.service}
                </small>
              </span>
              <i>→</i>
            </button>
          ))}
        </div>
      </OwnerPage>
    );

  if (view === 'edit' && selected)
    return (
      <OwnerPage mode={mode} error={error} publicSiteUrl={publicSiteUrl}>
        <Back onClick={() => setView('jobs')} />
        <h1>Edit job</h1>
        <label>
          Service
          <select value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value })}>
            {[...new Set([...business.services, 'Other'])].map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>
        </label>
        <label>
          Location
          <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </label>
        <label>
          Details
          <textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <h2>Photos</h2>
        <PhotoPicker images={editPhotos} onChange={setEditPhotos} label="ADD MORE PHOTOS" />
        <div className="owner-actions">
          <Button disabled={busy} onClick={saveEdit}>
            {busy ? 'SAVING…' : 'SAVE CHANGES'}
          </Button>
          <button className="btn outline" disabled={busy} onClick={togglePublished}>
            {selected.published ? 'UNPUBLISH' : 'PUBLISH'}
          </button>
          <button className="danger-button" disabled={busy} onClick={remove}>
            DELETE JOB
          </button>
        </div>
      </OwnerPage>
    );

  if (view === 'details')
    return (
      <BusinessDetails business={business} busy={busy} saveBusiness={saveBusiness} onBack={() => setView('home')} mode={mode} error={error} publicSiteUrl={publicSiteUrl} />
    );

  if (view === 'enquiries')
    return (
      <OwnerEnquiries
        business={business}
        enquiries={enquiries}
        onStatusChange={changeEnquiryStatus}
        onBack={() => setView('home')}
        mode={mode}
        error={error}
        publicSiteUrl={publicSiteUrl}
      />
    );

  return (
    <OwnerPage mode={mode} error={error} publicSiteUrl={publicSiteUrl}>
      <h1>Your website</h1>
      <button className="big-action" onClick={startAdd}>
        + ADD TODAY’S JOB
      </button>
      <div className="owner-menu">
        <button onClick={() => setView('enquiries')}>
          NEW ENQUIRIES <b>{enquiries.filter((item) => item.status === 'new').length}</b>
        </button>
        <button onClick={() => setView('jobs')}>
          MY JOBS <b>{projects.length}</b>
        </button>
        <button onClick={() => setView('details')}>BUSINESS DETAILS</button>
      </div>
    </OwnerPage>
  );
}

function OwnerPage({
  children,
  extra = '',
  mode,
  error,
  publicSiteUrl,
}: {
  children: React.ReactNode;
  extra?: string;
  mode: 'demo' | 'supabase';
  error?: string;
  publicSiteUrl: string;
}) {
  return (
    <main className={`owner ${extra}`}>
      <p className="demo">{mode === 'demo' ? 'DEMO MODE · YOUR WEBSITE' : 'YOUR WEBSITE'}</p>
      {/* Obvious, permanent way for the owner to see what customers see —
          mission section 6. Present on every /owner view, not just the
          home screen, and never the one-time claim link. */}
      <div className="owner-topbar">
        <a className="btn outline" href={publicSiteUrl} target="_blank" rel="noreferrer">
          VIEW MY WEBSITE ↗
        </a>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {children}
    </main>
  );
}

function BusinessDetails({
  business,
  busy,
  saveBusiness,
  onBack,
  mode,
  error,
  publicSiteUrl,
}: {
  business: Business;
  busy: boolean;
  saveBusiness: (business: Business) => Promise<void>;
  onBack: () => void;
  mode: 'demo' | 'supabase';
  publicSiteUrl: string;
  error: string;
}) {
  const [draft, setDraft] = useState(business);
  const update = (key: 'name' | 'phone' | 'whatsapp' | 'email' | 'town', value: string) => setDraft({ ...draft, [key]: value });
  const commit = () => {
    if (JSON.stringify(draft) !== JSON.stringify(business)) void saveBusiness(draft);
  };
  return (
    <OwnerPage mode={mode} error={error} publicSiteUrl={publicSiteUrl}>
      <Back onClick={onBack} />
      <h1>Business details</h1>
      <label>
        Business name
        <input value={draft.name} onChange={(event) => update('name', event.target.value)} onBlur={commit} />
      </label>
      <label>
        Public phone
        <input value={draft.phone} onChange={(event) => update('phone', event.target.value)} onBlur={commit} />
      </label>
      <label>
        WhatsApp number
        <input value={draft.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} onBlur={commit} />
      </label>
      <label>
        Email
        <input value={draft.email || ''} onChange={(event) => update('email', event.target.value)} onBlur={commit} />
      </label>
      <label>
        Base town
        <input value={draft.town} onChange={(event) => update('town', event.target.value)} onBlur={commit} />
      </label>
      <label>
        Years trading
        <input
          type="number"
          min="0"
          value={draft.years}
          onChange={(event) => setDraft({ ...draft, years: Number(event.target.value) })}
          onBlur={commit}
        />
      </label>
      {busy && <p className="hint">Saving…</p>}
      <h2>Services offered</h2>
      <ToggleList
        values={['Domestic scaffolding', 'Commercial scaffolding', 'Temporary roof', 'Roofing access']}
        selected={business.services}
        onChange={(services) => {
          setDraft({ ...draft, services });
          void saveBusiness({ ...business, services });
        }}
      />
      <h2>Areas covered</h2>
      <ToggleList
        values={['Chester', 'Wrexham', 'Mold', 'North Wales']}
        selected={business.areas}
        onChange={(areas) => {
          setDraft({ ...draft, areas });
          void saveBusiness({ ...business, areas });
        }}
      />
    </OwnerPage>
  );
}

function ToggleList({ values, selected, onChange }: { values: string[]; selected: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="choices">
      {values.map((value) => (
        <button
          type="button"
          className={selected.includes(value) ? 'on' : ''}
          key={value}
          onClick={() => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function OwnerEnquiries({
  business,
  enquiries,
  onStatusChange,
  onBack,
  mode,
  error,
  publicSiteUrl,
}: {
  business: Business;
  enquiries: Enquiry[];
  onStatusChange: (enquiry: Enquiry, status: Status) => void;
  onBack: () => void;
  mode: 'demo' | 'supabase';
  error: string;
  publicSiteUrl: string;
}) {
  return (
    <OwnerPage mode={mode} error={error} publicSiteUrl={publicSiteUrl}>
      <Back onClick={onBack} />
      <h1>New enquiries</h1>
      <div className="enquiry-list">
        {enquiries.map((enquiry) => (
          <article className="lead" key={enquiry.id}>
            <span className="status-pill">{enquiry.status}</span>
            <h2>
              {enquiry.reference} · {enquiry.name}
            </h2>
            <p>
              {enquiry.location} · {enquiry.work}
              <br />
              {enquiry.storeys} · {enquiry.width} · {enquiry.access}
            </p>
            <p>{enquiry.description}</p>
            {enquiry.photos.length > 0 && (
              <div className="enquiry-photos">
                {enquiry.photos.map((photo, index) => (
                  <a href={photo} target="_blank" rel="noreferrer" key={`${enquiry.id}-${index}`}>
                    <img src={photo} alt={`Customer photo ${index + 1} for ${enquiry.reference}`} />
                  </a>
                ))}
              </div>
            )}
            <div className="owner-actions">
              <a className="btn" href={`tel:${enquiry.mobile}`}>
                CALL
              </a>
              <a
                className="btn outline"
                target="_blank"
                rel="noreferrer"
                href={whatsAppUrl(enquiry.mobile, `Hi ${enquiry.name}, it’s ${business.name}. We’ve received your website quote request ${enquiry.reference}.`)}
              >
                WHATSAPP
              </a>
            </div>
            <div className="choices status-actions">
              {(['new', 'contacted', 'quoted', 'won', 'lost'] as Status[])
                .filter((status) => status !== enquiry.status && canTransition(enquiry.status, status))
                .map((status) => (
                  <button key={status} onClick={() => onStatusChange(enquiry, status)}>
                    MARK {status.toUpperCase()}
                  </button>
                ))}
            </div>
          </article>
        ))}
      </div>
    </OwnerPage>
  );
}
