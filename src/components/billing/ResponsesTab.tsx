import { useOrganization } from "@/contexts/OrganizationContext";
import {
  UploadSimple,
  FileText,
  Info,
  CaretRight,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function ResponsesTab() {
  const { currentOrganization } = useOrganization();

  const { data: responses, isLoading } = useQuery({
    queryKey: ["billing-responses", currentOrganization?.id],
    queryFn: async () => {
      // Placeholder for response ingestion logs
      return [
        {
          id: "1",
          file_name: "999_ACK_CLAIM_20240214.txt",
          type: "999 Acknowledgement",
          claim_control: "BC-20240214-001",
          status: "accepted",
          received_at: new Date().toISOString(),
          details: "1 claim accepted, 0 rejected",
        },
        {
          id: "2",
          file_name: "835_REMIT_CLAIM_20240201.txt",
          type: "835 Remittance",
          claim_control: "BC-20240201-042",
          status: "paid",
          received_at: new Date(Date.now() - 86400000).toISOString(),
          details: "Total PAID: $452.20",
        },
      ];
    },
    enabled: !!currentOrganization?.id,
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <Card className="col-span-1 border-emerald-100/60 bg-emerald-50/20 shadow-none rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-900 flex items-center gap-2">
              <UploadSimple size={18} weight="bold" />
              Ingest Response
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-[11px] text-emerald-800/80 leading-relaxed italic">
              Upload electronic response files (999, 277CA, or 835) to automate
              reconciliation.
            </p>
            <div className="border-2 border-dashed border-emerald-200/60 rounded-2xl p-8 text-center flex flex-col items-center justify-center bg-white/40 cursor-pointer hover:bg-white hover:border-emerald-400 transition-all group">
              <div className="bg-emerald-100 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <FileText
                  size={24}
                  weight="duotone"
                  className="text-emerald-600"
                />
              </div>
              <p className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">
                Drop EDI file here
              </p>
              <p className="text-[9px] text-emerald-600/60 mt-1 font-bold uppercase tracking-widest">
                .txt or .edi
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-3 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
              Recent Activity
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-900"
            >
              Export History
            </Button>
          </div>

          <Card className="border-slate-200/60 shadow-none overflow-hidden bg-white/40 backdrop-blur-sm rounded-2xl">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-900 h-12">
                    Flow Type
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-900 h-12">
                    Batch Reference
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-900 h-12">
                    Timestamp
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-900 h-12 text-center">
                    Result
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <ArrowsClockwise
                        size={20}
                        className="animate-spin inline-block mr-2"
                      />
                      Fetching logs...
                    </TableCell>
                  </TableRow>
                ) : (
                  responses?.map((resp) => (
                    <TableRow
                      key={resp.id}
                      className="hover:bg-slate-50/50 transition-colors border-slate-50"
                    >
                      <TableCell>
                        <span className="text-xs font-black text-slate-900 tracking-tight">
                          {resp.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] font-bold text-slate-400">
                        {resp.file_name}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-500 font-medium italic">
                        {format(new Date(resp.received_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={
                            resp.status === "paid" || resp.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[9px] uppercase"
                              : "bg-slate-50 text-slate-500 border-slate-100 font-black text-[9px] uppercase"
                          }
                        >
                          {resp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-300 hover:text-slate-900"
                        >
                          <CaretRight size={16} weight="bold" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 flex gap-4">
            <Info
              size={20}
              weight="duotone"
              className="text-slate-400 shrink-0"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed italic max-w-2xl">
              <span className="font-black text-slate-700 not-italic">
                Edge Service:
              </span>{" "}
              Automated SFTP polling is scheduled for 4-hour intervals. The
              system automatically reconciles matching Batch IDs in your Claim
              History.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
