import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function BillingNotice() {
  return (
    <Alert role="note">
      <Info aria-hidden="true" />
      <AlertTitle>Submissions happen outside this system.</AlertTitle>
      <AlertDescription>
        Record external claims, invoices, payer responses, and funds received here.
      </AlertDescription>
    </Alert>
  );
}
