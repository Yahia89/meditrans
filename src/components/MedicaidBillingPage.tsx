import { useState } from "react";
import {
  FileText,
  Plus,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  Filter,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgbillingSettings } from "./admin/OrgBillingSettings";
import { ClaimSummaryDialog } from "./ClaimSummaryDialog";
import { ClaimHistoryTable } from "./ClaimHistoryTable";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function MedicaidBillingPage() {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState("overview");
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

  const isBillingConfigured = !!(
    currentOrganization?.billing_enabled &&
    currentOrganization?.npi &&
    currentOrganization?.tax_id &&
    currentOrganization?.billing_state
  );

  // 1. Fetch Billable Trips Count
  const { data: billableTrips } = useQuery({
    queryKey: ["billable-trips-count", currentOrganization?.id],
    queryFn: async () => {
      try {
        const { data: claimLines } = await supabase
          .from("billing_claim_lines")
          .select("trip_id");

        const billedTripIds = claimLines?.map((l) => l.trip_id) || [];

        let query = supabase
          .from("trips")
          .select("id", { count: "exact" })
          .eq("organization_id", currentOrganization?.id)
          .eq("status", "completed");

        if (billedTripIds.length > 0) {
          query = query.not("id", "in", `(${billedTripIds.join(",")})`);
        }

        const { count } = await query;
        return count || 0;
      } catch (e) {
        console.warn("Billing tables may not be initialized yet:", e);
        return 0;
      }
    },
    enabled: !!currentOrganization?.id && isBillingConfigured,
  });

  // 2. Fetch Claim Stats
  const { data: claimStats } = useQuery({
    queryKey: ["billing-claim-stats", currentOrganization?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("billing_claims")
          .select("status")
          .eq("org_id", currentOrganization?.id);

        if (error) throw error;

        return {
          submitted: data.filter((c) => c.status === "submitted").length,
          accepted: data.filter(
            (c) => c.status === "accepted" || c.status === "paid",
          ).length,
          rejected: data.filter((c) => c.status === "rejected").length,
        };
      } catch (e) {
        console.warn("Claim tables may not be initialized yet:", e);
        return { submitted: 0, accepted: 0, rejected: 0 };
      }
    },
    enabled: !!currentOrganization?.id && isBillingConfigured,
  });

  // 3. Fetch Missing Data Counts
  const { data: auditData } = useQuery({
    queryKey: [
      "billing-audit",
      currentOrganization?.id,
      currentOrganization?.billing_state,
    ],
    queryFn: async () => {
      // Patients missing Medicaid ID
      const { data: patients } = await supabase
        .from("patients")
        .select("id")
        .eq("organization_id", currentOrganization?.id)
        .or("medicaid_id.is.null,medicaid_id.eq.''");

      // Drivers missing state-specific ID
      let driverQuery = supabase
        .from("drivers")
        .select("id")
        .eq("organization_id", currentOrganization?.id);

      if (currentOrganization?.billing_state === "MN") {
        driverQuery = driverQuery.or("umpi.is.null,umpi.eq.''");
      } else {
        driverQuery = driverQuery.or("npi.is.null,npi.eq.''");
      }

      const { data: drivers } = await driverQuery;

      return {
        missingMedicaidIds: patients?.length || 0,
        missingDriverIds: drivers?.length || 0,
      };
    },
    enabled: !!currentOrganization?.id && !!currentOrganization?.billing_state,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <ClaimSummaryDialog
        open={isClaimDialogOpen}
        onOpenChange={setIsClaimDialogOpen}
        onSuccess={() => setActiveTab("pending")}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Medicaid Billing (coming soon)
          </h1>
          <p className="text-slate-500">
            {isBillingConfigured
              ? `Direct electronic claim filing (837P) for ${
                  currentOrganization.billing_state === "MN"
                    ? "MN-ITS"
                    : "Medi-Cal"
                }`
              : "Set up your organization's billing credentials to begin."}
          </p>
        </div>
        {isBillingConfigured && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setActiveTab("history")}
            >
              <History className="w-4 h-4" />
              History
            </Button>
            <Button
              onClick={() => setIsClaimDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-200"
            >
              <Plus className="w-4 h-4" />
              New Claim Batch
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="gap-2"
            disabled={!isBillingConfigured}
          >
            <Clock className="w-4 h-4" /> Pending
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="gap-2"
            disabled={!isBillingConfigured}
          >
            <History className="w-4 h-4" /> Past Claims
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Filter className="w-4 h-4" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none">
          {!isBillingConfigured ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
              <div className="bg-slate-50 p-6 rounded-full">
                <FileText className="w-12 h-12 text-slate-300" />
              </div>
              <div className="max-w-md space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">
                  Billing Not Configured
                </h2>
                <p className="text-slate-500">
                  To start generating 837P electronic claims, you need to set up
                  your organization's NPI, Tax ID, and Billing State.
                </p>
              </div>
              <Button
                onClick={() => setActiveTab("settings")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 px-8 rounded-xl transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Configure Settings Now
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Ready to Bill"
                  value={billableTrips?.toString() || "0"}
                  subtitle="Unclaimed trips"
                  icon={<Plus className="w-5 h-5 text-emerald-600" />}
                />
                <StatCard
                  title="Submitted"
                  value={claimStats?.submitted.toString() || "0"}
                  subtitle="Pending response"
                  icon={<Clock className="w-5 h-5 text-blue-600" />}
                />
                <StatCard
                  title="Accepted"
                  value={claimStats?.accepted.toString() || "0"}
                  subtitle="Total success"
                  icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                />
                <StatCard
                  title="Rejected"
                  value={claimStats?.rejected.toString() || "0"}
                  subtitle="Needs attention"
                  icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Recent Claim Activity</CardTitle>
                        <CardDescription>
                          Monitor status of your most recent 837P submissions.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ClaimHistoryTable
                      statusFilter={[
                        "generated",
                        "submitted",
                        "accepted",
                        "rejected",
                        "paid",
                      ]}
                    />
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-lg">Filing Readiness</CardTitle>
                    <CardDescription>
                      Checklist for state submission.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      <CheckItem
                        label="Organization NPI & Tax ID"
                        complete={
                          !!currentOrganization.npi &&
                          !!currentOrganization.tax_id
                        }
                      />
                      <CheckItem
                        label="Billing State (MN/CA)"
                        complete={!!currentOrganization.billing_state}
                      />
                      <CheckItem
                        label="Driver UMPI/NPI Mappings"
                        complete={auditData?.missingDriverIds === 0}
                        warning={
                          auditData?.missingDriverIds
                            ? `${auditData.missingDriverIds} drivers missing IDs`
                            : undefined
                        }
                      />
                      <CheckItem
                        label="Patient Medicaid IDs"
                        complete={auditData?.missingMedicaidIds === 0}
                        warning={
                          auditData?.missingMedicaidIds
                            ? `${auditData.missingMedicaidIds} patients missing IDs`
                            : undefined
                        }
                      />
                    </div>
                    <div className="p-6 bg-slate-50/50">
                      <Button
                        variant="secondary"
                        className="w-full bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => setActiveTab("settings")}
                      >
                        Correct Missing Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="pending" className="outline-none">
          <ClaimHistoryTable statusFilter={["generated", "submitted"]} />
        </TabsContent>

        <TabsContent value="history" className="outline-none">
          <ClaimHistoryTable statusFilter={["accepted", "rejected", "paid"]} />
        </TabsContent>

        <TabsContent value="settings" className="outline-none">
          <OrgbillingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendType,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: "up" | "down";
}) {
  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
            {icon}
          </div>
          {trend && (
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                trendType === "up"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {trend}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-bold text-slate-900">{value}</h4>
          </div>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckItem({
  label,
  complete,
  warning,
}: {
  label: string;
  complete: boolean;
  warning?: string;
}) {
  return (
    <div className="p-4 flex items-center gap-3">
      {complete ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
      )}
      <div className="flex-1">
        <p
          className={`text-sm font-medium ${
            complete ? "text-slate-700" : "text-slate-400"
          }`}
        >
          {label}
        </p>
        {warning && (
          <p className="text-[11px] text-amber-600 font-medium">{warning}</p>
        )}
      </div>
      {!complete && <Plus className="w-4 h-4 text-slate-300" />}
    </div>
  );
}
