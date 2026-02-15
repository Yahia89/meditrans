import { useState } from "react";
import {
  Plus,
  MagnifyingGlass,
  WarningCircle,
  DotsThree,
  CaretRight,
  ShieldCheck,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format } from "date-fns";

export function ServiceAgreementsTab() {
  const { currentOrganization } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: agreements, isLoading } = useQuery({
    queryKey: ["service-agreements", currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_service_agreements")
        .select(
          `
          *,
          patient:patients(full_name, medicaid_id),
          lines:billing_service_agreement_lines(*)
        `,
        )
        .eq("org_id", currentOrganization?.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Service Agreement tables might be missing:", error);
        return [];
      }
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search Patient or Agreement #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-white border-slate-200/60 shadow-none focus-visible:ring-slate-400"
          />
        </div>
        <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2 h-11 px-6 font-bold shadow-xl shadow-slate-900/10 transition-all active:scale-95">
          <Plus size={18} weight="bold" />
          Add Service Agreement
        </Button>
      </div>

      <Card className="border-slate-200/60 shadow-none overflow-hidden bg-white/50 backdrop-blur-sm rounded-xl">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="font-bold text-slate-900 uppercase text-[10px] tracking-widest h-12">
                Agreement #
              </TableHead>
              <TableHead className="font-bold text-slate-900 uppercase text-[10px] tracking-widest h-12">
                Patient
              </TableHead>
              <TableHead className="font-bold text-slate-900 uppercase text-[10px] tracking-widest h-12">
                Period
              </TableHead>
              <TableHead className="font-bold text-slate-900 uppercase text-[10px] tracking-widest h-12">
                Codes
              </TableHead>
              <TableHead className="font-bold text-slate-900 uppercase text-[10px] tracking-widest h-12 text-center">
                Status
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex items-center justify-center gap-3 text-slate-400 font-bold italic">
                    <ArrowsClockwise
                      size={20}
                      className="animate-spin"
                      weight="duotone"
                    />
                    Synchronizing...
                  </div>
                </TableCell>
              </TableRow>
            ) : agreements?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="bg-slate-50 p-6 rounded-full">
                      <ShieldCheck
                        size={40}
                        weight="duotone"
                        className="text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-600 font-black">
                        No Active Records
                      </p>
                      <p className="text-slate-400 text-xs max-w-xs mx-auto italic">
                        Authorized service agreements are required for automated
                        trip validation and claim filing.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              agreements?.map((ag) => (
                <TableRow
                  key={ag.id}
                  className="hover:bg-slate-50/50 transition-colors border-slate-50"
                >
                  <TableCell className="font-mono text-[11px] font-black text-slate-900">
                    {ag.agreement_number}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">
                        {ag.patient?.full_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                        ID: {ag.patient?.medicaid_id || "MISSING"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs font-medium italic">
                    {format(new Date(ag.effective_date), "MMM d")} -{" "}
                    {format(new Date(ag.expiration_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {ag.lines?.map((line: any) => (
                        <Badge
                          key={line.id}
                          variant="secondary"
                          className="text-[9px] font-black bg-slate-100 text-slate-600 border-none px-2"
                        >
                          {line.hcpcs_code}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        ag.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[9px] uppercase tracking-widest"
                          : "bg-slate-50 text-slate-500 border-slate-100 font-black text-[9px] uppercase tracking-widest"
                      }
                    >
                      {ag.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-slate-100 rounded-full"
                        >
                          <DotsThree
                            size={24}
                            weight="bold"
                            className="text-slate-400"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 p-1.5 shadow-2xl border-slate-200/60 rounded-xl"
                      >
                        <DropdownMenuItem className="cursor-pointer font-bold text-xs gap-2 focus:bg-slate-50 focus:text-slate-900 rounded-lg">
                          <CaretRight size={14} weight="bold" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer font-bold text-xs gap-2 text-red-600 focus:bg-red-50 focus:text-red-700 rounded-lg">
                          <Plus size={14} weight="bold" className="rotate-45" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="bg-amber-50/50 border border-amber-100/60 rounded-2xl p-6 flex gap-4">
        <WarningCircle
          size={28}
          weight="duotone"
          className="text-amber-600 shrink-0"
        />
        <div className="space-y-1">
          <h4 className="text-sm font-black text-amber-900 tracking-tight">
            Authorization Enforcement
          </h4>
          <p className="text-xs text-amber-800/80 leading-relaxed max-w-3xl italic">
            Direct billing requires a valid Prior Authorization Number (SA #).
            Our validator verifies every trip against these records to ensure
            rate accuracy and eligibility before transmission.
          </p>
        </div>
      </div>
    </div>
  );
}
