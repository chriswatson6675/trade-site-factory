/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { Business, Project } from '../lib/data/types';
import { businessCopy, publicProjects, whatsAppUrl } from '../lib/domain';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

export function NotFound() {
  return (
    <main className="form-page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>That page is not part of this website.</p>
    </main>
  );
}

export function PublicHeader({ business }: { business: Business }) {
  const root = `/sites/${business.slug}`;
  return (
    <header className="header">
      <Link className="logo" href={root}>
        <b>{initials(business.name)}</b>
        <span>
          {business.name}
          <small>TRADE WEBSITE</small>
        </span>
      </Link>
      <nav>
        <Link href={root}>Home</Link>
        <Link href={`${root}/services`}>Services</Link>
        <Link href={`${root}/projects`}>Recent Jobs</Link>
        <Link href={`${root}/areas`}>Areas</Link>
        <Link href={`${root}/about`}>About</Link>
      </nav>
      <Link className="btn" href={`${root}/quote`}>
        Get a quote
      </Link>
    </header>
  );
}

export function MobileActions({ business }: { business: Business }) {
  return (
    <div className="sticky">
      <a href={`tel:${business.phone.replace(/\s/g, '')}`}>CALL</a>
      <a target="_blank" rel="noreferrer" href={whatsAppUrl(business.whatsapp, 'Hi, I would like a quote.')}>
        WHATSAPP
      </a>
      <Link href={`/sites/${business.slug}/quote`}>GET A QUOTE</Link>
    </div>
  );
}

export function PageChrome({ business, children }: { business: Business; children: React.ReactNode }) {
  return (
    <>
      <PublicHeader business={business} />
      {children}
      <MobileActions business={business} />
    </>
  );
}

export function Listing({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="section listing-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export function DemoVisual() {
  return (
    <div className="visual" role="img" aria-label="Demo scaffolding project placeholder">
      <i />
      <i />
      <i />
      <span>DEMO PROJECT</span>
    </div>
  );
}

export function Home({ business, projects }: { business: Business; projects: Project[] }) {
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Scaffolding across {business.areas.slice(0, 2).join(' & ') || business.town}</p>
          <h1>
            Safe access.
            <br />
            <em>Properly planned.</em>
          </h1>
          <p>{businessCopy(business.years, business.services, business.areas)}</p>
          <div className="actions">
            <Link className="btn" href={`/sites/${business.slug}/quote`}>
              GET A QUOTE
            </Link>
            <a href={`tel:${business.phone.replace(/\s/g, '')}`}>Call {business.phone}</a>
          </div>
        </div>
        <DemoVisual />
      </section>
      <section className="section">
        <p className="eyebrow">Recent jobs</p>
        <ProjectCards business={business} projects={publicProjects(projects, business.id).slice(0, 3)} />
      </section>
    </main>
  );
}

export function ProjectCards({ business, projects }: { business: Business; projects: Project[] }) {
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <Link className="project" href={`/sites/${business.slug}/projects/${project.slug}`} key={project.id}>
          {project.images[0] ? (
            <img className="project-cover" src={project.images[0]} alt={`${project.title} in ${project.location}`} />
          ) : (
            <DemoVisual />
          )}
          <small>{project.location}</small>
          <h2>{project.title}</h2>
        </Link>
      ))}
    </div>
  );
}

export function ProjectDetail({ business, project }: { business: Business; project: Project }) {
  return (
    <main className="project-page">
      <div>
        <p className="eyebrow">Recent work · {project.location}</p>
        <h1>{project.title}</h1>
        <p>{project.description}</p>
        <a
          className="text-link"
          target="_blank"
          rel="noreferrer"
          href={whatsAppUrl(business.whatsapp, `Hi, I’ve just seen your ${project.title} project in ${project.location}. I’m looking for something similar.`)}
        >
          Ask about a similar job →
        </a>
      </div>
      <div className="project-gallery">
        {project.images.length ? (
          project.images.map((image, index) => (
            <img src={image} alt={`${project.title} in ${project.location}, photo ${index + 1}`} key={`${project.id}-${index}`} />
          ))
        ) : (
          <DemoVisual />
        )}
      </div>
    </main>
  );
}

export function ServicePage({ business, service, projects }: { business: Business; service: string; projects: Project[] }) {
  const related = publicProjects(projects, business.id).filter((project) => project.service === service);
  return (
    <Listing eyebrow={`Service in ${business.town}`} title={service}>
      <p className="large-copy">
        We provide {service.toLowerCase()} throughout {business.areas.join(', ')}.
      </p>
      {related.length > 0 && (
        <>
          <h2>Related work</h2>
          <ProjectCards business={business} projects={related} />
        </>
      )}
    </Listing>
  );
}

export function AreaPage({ business, area, projects }: { business: Business; area: string; projects: Project[] }) {
  const related = publicProjects(projects, business.id).filter((project) => project.location.toLowerCase().includes(area.toLowerCase()));
  return (
    <Listing eyebrow="Area covered" title={area}>
      <p className="large-copy">{business.name} provides its selected scaffolding services in {area}.</p>
      {related.length > 0 && (
        <>
          <h2>Recent work in {area}</h2>
          <ProjectCards business={business} projects={related} />
        </>
      )}
    </Listing>
  );
}
