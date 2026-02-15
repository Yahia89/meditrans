import { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  FileText,
  Clock,
  Gear,
  ChartBar,
  UploadSimple,
  Plus,
  ShieldCheck,
  Pulse,
  Lightning,
  Export,
} from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ClaimSummaryDialog } from "./ClaimSummaryDialog";
import { ClaimHistoryTable } from "./ClaimHistoryTable";
import { OrgbillingSettings } from "./admin/OrgBillingSettings";
import { ServiceAgreementsTab } from "./billing/ServiceAgreementsTab";
import { ResponsesTab } from "./billing/ResponsesTab";

export function MedicaidBillingPage() {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState("overview");
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

  const isBillingConfigured = !!(
    currentOrganization?.billing_enabled &&
    currentOrganization?.npi &&
    currentOrganization?.tax_id
  );

  const isDirectAutomation = !!(
    currentOrganization?.sftp_enabled &&
    currentOrganization?.mn_its_submitter_id
  );

  const { data: billableCount = 0 } = useQuery({
    queryKey: ["billable-trips-count", currentOrganization?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("trips")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrganization?.id)
        .eq("status", "completed")
        .is("billing_status", null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentOrganization?.id,
  });

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Claims Management
            {isDirectAutomation ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                <Lightning
                  size={16}
                  weight="duotone"
                  className="text-emerald-600 animate-pulse"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  Automation Active
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full">
                <Export size={16} weight="duotone" className="text-slate-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Manual Mode
                </span>
              </div>
            )}
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Generate, validate, and transmit electronic 837P claim batches.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setActiveTab("responses")}
            className="border-slate-200 hover:bg-slate-50 gap-2 h-11 font-bold text-slate-700"
          >
            <UploadSimple size={20} weight="duotone" />
            Upload Response
          </Button>
          <Button
            onClick={() => setIsClaimDialogOpen(true)}
            disabled={!isBillingConfigured || billableCount === 0}
            className="bg-slate-900 text-white hover:bg-slate-800 gap-2 h-11 px-6 font-bold shadow-xl shadow-slate-900/10"
          >
            <Plus size={20} weight="bold" />
            New Claim Batch
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-8"
      >
        <div className="border-b border-slate-200">
          <TabsList className="h-auto p-0 bg-transparent gap-8">
            {[
              { id: "overview", label: "Overview", icon: Pulse },
              {
                id: "ready",
                label: "Ready to File",
                icon: FileText,
                count: billableCount,
              },
              { id: "history", label: "Claim History", icon: Clock },
              {
                id: "agreements",
                label: "Service Agreements",
                icon: ShieldCheck,
              },
              { id: "responses", label: "Responses", icon: ChartBar },
              { id: "settings", label: "Settings", icon: Gear },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="group flex items-center gap-2.5 px-1 py-4 text-sm font-bold text-slate-500 data-[state=active]:text-slate-900 data-[state=active]:border-b-2 data-[state=active]:border-slate-900 rounded-none bg-transparent transition-all"
              >
                <tab.icon
                  size={20}
                  weight="duotone"
                  className="group-data-[state=active]:text-slate-900 transition-colors"
                />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-slate-900 text-white text-[10px] rounded-full">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-slate-200/60 shadow-none bg-white/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Total Billed (MTD)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-900">
                  $12,450.00
                </div>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">
                  +12% from last month
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/60 shadow-none bg-white/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Avg. Processing Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-900">
                  4.2 Days
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  From submission to payment
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/60 shadow-none bg-white/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Accepted Claims
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-emerald-600">
                  98.4%
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  First-pass acceptance rate
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/60 shadow-none bg-white/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Pending Response
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-amber-600">
                  3 Batches
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  Waiting for 999/835
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ready" className="mt-0 outline-none">
          <Card className="border-slate-200/60 shadow-none overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/30 p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-black text-slate-900">
                    Unbilled Completed Trips
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {billableCount} trips are completed and ready for
                    processing.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsClaimDialogOpen(true)}
                  disabled={billableCount === 0}
                  className="bg-slate-900 text-white font-bold"
                >
                  Generate 837P Batch
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-12 text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText
                    size={40}
                    weight="duotone"
                    className="text-slate-300"
                  />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Ready to file?
                </h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm italic leading-relaxed">
                  Start the claim batching process to validate these trips and
                  generate a compliant HIPAA 837P file.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-0 outline-none">
          <ClaimHistoryTable />
        </TabsContent>

        <TabsContent value="agreements" className="mt-0 outline-none">
          <ServiceAgreementsTab />
        </TabsContent>

        <TabsContent value="responses" className="mt-0 outline-none">
          <ResponsesTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-0 outline-none">
          <OrgbillingSettings />
        </TabsContent>
      </Tabs>

      <ClaimSummaryDialog
        open={isClaimDialogOpen}
        onOpenChange={setIsClaimDialogOpen}
        onSuccess={() => {
          // Success handled in dialog
        }}
      />
    </div>
  );
}
