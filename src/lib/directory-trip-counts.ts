import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type Directory = "patients" | "drivers";

export function directoryTripCountsOptions(orgId: string | undefined, directory: Directory) {
  return queryOptions({
    // Trip creation, reassignment, and deletion already invalidate this prefix.
    queryKey: ["trips", "directory-counts", orgId, directory],
    enabled: !!orgId,
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }): Promise<Record<string, number>> => {
      if (!orgId) throw new Error("An organization is required for trip totals.");
      const counts: Record<string, number> = {};
      let offset = 0;
      let total: number | undefined;
      let previousId = "";
      do {
        const { data, error, count } = await supabase
          .rpc("directory_trip_counts", { p_org_id: orgId, p_directory: directory }, { count: "exact" })
          .order("entity_id", { ascending: true })
          .range(offset, offset + 499)
          .abortSignal(signal);
        if (error) throw error;
        if (!Array.isArray(data) || count === null || !Number.isSafeInteger(count) || count < 0) {
          throw new Error("Trip totals could not be loaded.");
        }
        if (total !== undefined && total !== count) {
          throw new Error("Trip totals changed while loading. Please retry.");
        }
        total = count;
        if (offset + data.length > total || (data.length === 0 && offset < total)) {
          throw new Error("Trip totals could not be loaded completely.");
        }
        for (const row of data) {
          const value = Number(row.total_trips);
          if (typeof row.entity_id !== "string" || row.entity_id <= previousId
            || row.total_trips === null || !Number.isSafeInteger(value) || value < 0) {
            throw new Error("Trip totals could not be loaded completely.");
          }
          counts[row.entity_id] = value;
          previousId = row.entity_id;
        }
        // Respect server row caps below the requested page size. A missing
        // entity only means zero once every visible count group was loaded.
        offset += data.length;
      } while (offset < total);
      return counts;
    },
  });
}
