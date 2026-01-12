import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { download837PFile } from "@/lib/billing/837p-generator";

interface ClaimHistoryTableProps {
  statusFilter?: string[];
}

export function ClaimHistoryTable({ statusFilter }: ClaimHistoryTableProps) {
  const { currentOrganization } = useOrganization();

  const { data: claims, isLoading } = useQuery({
    queryKey: ["billing-claims", currentOrganization?.id, statusFilter],
    queryFn: async () => {
      try {
        let query = supabase
          .from("billing_claims")
          .select("*")
          .eq("org_id", currentOrganization?.id)
          .order("created_at", { ascending: false });

        if (statusFilter && statusFilter.length > 0) {
          query = query.in("status", statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      } catch (e) {
        console.warn("Claim history table not found or accessible:", e);
        return [];
      }
    },
    enabled: !!currentOrganization?.id,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
      case "paid":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {status.toUpperCase()}
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="destructive"
            className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            REJECTED
          </Badge>
        );
      case "submitted":
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            SUBMITTED
          </Badge>
        );
      case "generated":
        return (
          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">
            <FileText className="w-3 h-3 mr-1" />
            GENERATED
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status.toUpperCase()}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Clock className="w-6 h-6 animate-pulse text-slate-400" />
      </div>
    );
  }

  if (!claims || claims.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No claims found</p>
        <p className="text-slate-400 text-sm">
          Start a new batch to generate claims
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow>
            <TableHead className="font-semibold text-slate-900">
              Control #
            </TableHead>
            <TableHead className="font-semibold text-slate-900">
              Status
            </TableHead>
            <TableHead className="font-semibold text-slate-900">
              Period
            </TableHead>
            <TableHead className="font-semibold text-slate-900">
              Lines
            </TableHead>
            <TableHead className="font-semibold text-slate-900 text-right">
              Total Charge
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {claims.map((claim) => (
            <TableRow
              key={claim.id}
              className="hover:bg-slate-50/50 transition-colors"
            >
              <TableCell className="font-medium text-slate-700">
                {claim.claim_control_number}
              </TableCell>
              <TableCell>{getStatusBadge(claim.status)}</TableCell>
              <TableCell className="text-slate-500 text-sm">
                {format(new Date(claim.billing_period_start), "MMM d")} -{" "}
                {format(new Date(claim.billing_period_end), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-slate-600">
                {claim.total_trips} trips
              </TableCell>
              <TableCell className="text-right font-semibold text-slate-900">
                ${Number(claim.total_charge).toFixed(2)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        if (
                          claim.generated_file_data &&
                          claim.generated_file_name
                        ) {
                          download837PFile(
                            claim.generated_file_data,
                            claim.generated_file_name
                          );
                        } else {
                          alert("No file content available for this claim.");
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download 837P
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <ChevronRight className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
