// Wraps the allocate_enquiry_reference() Postgres function (see
// supabase/migrations/20260829120200_enquiry_reference.sql) with a
// runtime shape check, so a malformed/empty RPC response fails loudly
// instead of silently producing a bad reference.
const REFERENCE_PATTERN = /^Q-\d+$/;

export type ReferenceRpcClient = {
  // PromiseLike, not Promise: the real SupabaseClient.rpc() returns a
  // thenable query builder, not a literal Promise.
  rpc(
    fn: 'allocate_enquiry_reference',
    args: { p_business_id: string },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function allocateEnquiryReference(client: ReferenceRpcClient, businessId: string): Promise<string> {
  const { data, error } = await client.rpc('allocate_enquiry_reference', { p_business_id: businessId });
  if (error) throw new Error(`Could not allocate an enquiry reference: ${error.message}`);
  if (typeof data !== 'string' || !REFERENCE_PATTERN.test(data)) {
    throw new Error(`allocate_enquiry_reference returned an unexpected value: ${JSON.stringify(data)}`);
  }
  return data;
}
