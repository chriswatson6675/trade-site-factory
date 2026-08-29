export function ConfigRequired() {
  return (
    <main className="form-page">
      <p className="eyebrow">Configuration required</p>
      <h1>This deployment isn’t connected to its database yet</h1>
      <p>
        NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set for this Production deployment. Add
        them in the Vercel project’s environment variables and redeploy — see .env.example.
      </p>
    </main>
  );
}
