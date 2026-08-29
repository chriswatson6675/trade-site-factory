// Pure content builder for the one-time post-claim welcome email (mission
// section 2). Deliberately takes only the two permanent links plus the
// business name — never a claim token, never anything Supabase/Vercel-
// specific — so there is no way for this function to leak either by
// accident. See test/welcome-email.test.ts for the content guarantees this
// is held to.
export type WelcomeEmailInput = {
  businessName: string;
  manageUrl: string;
  viewUrl: string;
};

export type WelcomeEmailContent = {
  subject: string;
  html: string;
  text: string;
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildOwnerWelcomeEmail({ businessName, manageUrl, viewUrl }: WelcomeEmailInput): WelcomeEmailContent {
  const subject = 'Your website is ready';
  const safeName = escapeHtml(businessName);

  const text = [
    `Your website is now connected to your account.`,
    ``,
    `${businessName} is live and ready to go.`,
    ``,
    `MANAGE MY WEBSITE`,
    `Add jobs and photos, edit your business information, and manage enquiries:`,
    manageUrl,
    ``,
    `VIEW MY WEBSITE`,
    `See exactly what your customers see:`,
    viewUrl,
    ``,
    `Keep this email — you can use these links whenever you need them.`,
  ].join('\n');

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#15201e">
  <p style="font-size:11px;letter-spacing:.14em;font-weight:800;text-transform:uppercase;color:#5d716a">Your website is ready</p>
  <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:32px;margin:0 0 16px">Your website is now connected to your account.</h1>
  <p style="font-size:15px;color:#50605b">${safeName} is live and ready to go.</p>

  <div style="margin:28px 0">
    <a href="${manageUrl}" style="display:inline-block;background:#d9ef59;color:#15201e;font-weight:800;font-size:14px;padding:14px 22px;border-radius:3px;text-decoration:none">MANAGE MY WEBSITE</a>
  </div>
  <p style="font-size:13px;color:#5f6b66;margin:-20px 0 24px">Add jobs and photos, edit your business information, and manage enquiries.<br>${manageUrl}</p>

  <div style="margin:28px 0">
    <a href="${viewUrl}" style="display:inline-block;background:transparent;border:1px solid #9ba39d;color:#15201e;font-weight:800;font-size:14px;padding:13px 21px;border-radius:3px;text-decoration:none">VIEW MY WEBSITE</a>
  </div>
  <p style="font-size:13px;color:#5f6b66;margin:-20px 0 24px">See exactly what your customers see.<br>${viewUrl}</p>

  <p style="font-size:13px;color:#5f6b66">Keep this email — you can use these links whenever you need them.</p>
</div>`.trim();

  return { subject, html, text };
}
