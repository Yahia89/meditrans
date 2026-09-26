import { useState } from "react";
import { FileText, Plus, Coins, ShieldCheck, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BillingNotice } from "./BillingNotice";
import { BillingOverviewCards } from "./BillingOverviewCards";
import { BillingRecordsTable } from "./BillingRecordsTable";
import { BillingRecordDetailDialog } from "./BillingRecordDetailDialog";
import { AddBillingRecordDialog } from "./AddBillingRecordDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { PaymentsListTab } from "./PaymentsListTab";
import { PayersManagementTab } from "./PayersManagementTab";
import { ServiceAgreementsTab } from "@/components/billing/ServiceAgreementsTab";

export function BillingModule() {
  const [activeTab, setActiveTab] = useState<string>("records");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [addRecordOpen, setAddRecordOpen] = useState<boolean>(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState<boolean>(false);
  const [filterActionNeeded, setFilterActionNeeded] = useState<boolean>(false);

  const handleOpenActionNeeded = () => {
    setFilterActionNeeded(true);
    setActiveTab("records");
  };

  return (
    <section aria-labelledby="billing-heading" className="billing-surface @container/billing mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-6 py-2 sm:px-2 lg:px-4">
      {/* Top Header */}
      <div className="flex min-w-0 flex-col gap-4 @4xl/billing:flex-row @4xl/billing:items-center @4xl/billing:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 id="billing-heading" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Billing & Payments
            </h1>
            <Badge variant="secondary">Manual tracking</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Track external claims, invoices, payer responses, and payments.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 @4xl/billing:flex @4xl/billing:shrink-0">
          <Button
            variant="outline"
            onClick={() => setRecordPaymentOpen(true)}
            className="min-h-11"
          >
            <Coins data-icon="inline-start" />
            Record Payment
          </Button>

          <Button
            onClick={() => setAddRecordOpen(true)}
            className="min-h-11"
          >
            <Plus data-icon="inline-start" />
            Add Billing Record
          </Button>
        </div>
      </div>

      {/* Manual Notice Banner */}
      <BillingNotice />

      {/* Overview Statistics Cards */}
      <BillingOverviewCards onActionNeededClick={handleOpenActionNeeded} />

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 gap-5">
        <div className="min-w-0 max-w-full overflow-x-auto pb-1">
          <TabsList aria-label="Billing workspace" className="h-auto min-h-11 w-max min-w-full justify-start gap-1">
            {[
              { id: "records", label: "Billing records", icon: FileText },
              { id: "payments", label: "Payments", icon: Coins },
              { id: "agreements", label: "Authorizations", icon: ShieldCheck },
              { id: "payers", label: "Payers", icon: Building2 },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="min-h-10 shrink-0 gap-2 px-3"
              >
                <tab.icon aria-hidden="true" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab 1: Billing Records */}
        <TabsContent value="records" className="min-w-0">
          <BillingRecordsTable
            key={filterActionNeeded ? "action-needed" : "all"}
            initialActionNeeded={filterActionNeeded}
            onSelectRecord={(id) => setSelectedRecordId(id)}
            onAddRecordClick={() => setAddRecordOpen(true)}
          />
        </TabsContent>

        {/* Tab 2: Payments */}
        <TabsContent value="payments" className="min-w-0">
          <PaymentsListTab />
        </TabsContent>

        {/* Tab 3: Service Agreements */}
        <TabsContent value="agreements" className="min-w-0">
          <ServiceAgreementsTab />
        </TabsContent>

        {/* Tab 4: Payers */}
        <TabsContent value="payers" className="min-w-0">
          <PayersManagementTab />
        </TabsContent>

      </Tabs>

      {/* Record Detail Dialog */}
      <BillingRecordDetailDialog
        open={!!selectedRecordId}
        onOpenChange={(open) => !open && setSelectedRecordId(null)}
        recordId={selectedRecordId}
        onResubmitClick={() => {
          setSelectedRecordId(null);
          setAddRecordOpen(true);
        }}
      />

      {/* Add Billing Record Dialog */}
      <AddBillingRecordDialog
        open={addRecordOpen}
        onOpenChange={setAddRecordOpen}
      />

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
      />
    </section>
  );
}
