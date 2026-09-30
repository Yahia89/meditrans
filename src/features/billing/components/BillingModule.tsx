import { useState } from "react";
import { FileText, Plus, Coins } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { BillingOverviewCards } from "./BillingOverviewCards";
import { BillingRecordsTable } from "./BillingRecordsTable";
import { BillingRecordDetailDialog } from "./BillingRecordDetailDialog";
import { AddBillingRecordDialog } from "./AddBillingRecordDialog";
import { PaymentsListTab } from "./PaymentsListTab";

export function BillingModule() {
  const { currentOrganization } = useOrganization();
  return <BillingWorkspace key={currentOrganization?.id} />;
}

function BillingWorkspace() {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [addRecordOpen, setAddRecordOpen] = useState(false);

  return (
    <section aria-labelledby="billing-heading" className="billing-surface @container/billing mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-6 py-2 sm:px-2 lg:px-4">
      <div className="flex min-w-0 flex-col gap-4 @4xl/billing:flex-row @4xl/billing:items-center @4xl/billing:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 id="billing-heading" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Billing & Payments</h1>
          <p className="text-sm text-muted-foreground">Track what you submitted, who you billed, and what you received.</p>
        </div>
        <Button onClick={() => setAddRecordOpen(true)} className="min-h-11 @4xl/billing:shrink-0">
          <Plus data-icon="inline-start" />Add billing record
        </Button>
      </div>

      <BillingOverviewCards />

      <Tabs defaultValue="records" className="min-w-0 gap-5">
        <TabsList aria-label="Billing workspace" className="h-auto min-h-11 w-full sm:w-fit">
          <TabsTrigger value="records" className="min-h-10 gap-2 px-4"><FileText aria-hidden="true" />Billing records</TabsTrigger>
          <TabsTrigger value="payments" className="min-h-10 gap-2 px-4"><Coins aria-hidden="true" />Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="min-w-0">
          <BillingRecordsTable onSelectRecord={setSelectedRecordId} onAddRecordClick={() => setAddRecordOpen(true)} />
        </TabsContent>
        <TabsContent value="payments" className="min-w-0">
          <PaymentsListTab onSelectRecord={setSelectedRecordId} />
        </TabsContent>
      </Tabs>

      <BillingRecordDetailDialog
        key={selectedRecordId}
        open={!!selectedRecordId}
        onOpenChange={(open) => { if (!open) setSelectedRecordId(null); }}
        recordId={selectedRecordId}
      />
      {addRecordOpen && <AddBillingRecordDialog open onOpenChange={setAddRecordOpen} />}
    </section>
  );
}
