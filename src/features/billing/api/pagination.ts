// PostgREST caps unbounded reads. Walk pages so totals, search and CSV exports
// include every matching record instead of silently stopping at that cap.
export async function readBillingRows<Row>(query: {
  range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>;
}): Promise<Row[]> {
  const pageSize = 500;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
