import {
  CreditCard,
  ShieldCheck,
  Zap,
  ArrowRight,
  Wallet,
  History,
  Receipt,
  Lock,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";

export function BillingPage() {
  const { isOwner, isAdmin } = usePermissions();
  const canManageBilling = isOwner || isAdmin;

  if (!canManageBilling) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-[70vh] text-center p-8">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Access Restricted
        </h2>
        <p className="text-slate-500 max-w-sm">
          Billing management is only available to organization owners and
          administrators. Please contact your administrator if you believe this
          is an error.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Billing & Subscription
            </h1>
            <p className="text-slate-500">
              Manage your organization's payment methods and subscription plan.
            </p>
          </div>
        </div>

        <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-6 font-bold flex items-center gap-2 group shadow-lg transition-all hover:scale-[1.02]">
          Manage Payment Methods
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      <Separator className="bg-slate-200" />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Current Plan Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 relative">
            <div className="absolute top-0 right-0 p-8">
              <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Current Plan
              </div>
            </div>

            <div className="flex items-start gap-6 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <Zap className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Professional Plan
                </h2>
                <p className="text-slate-500">
                  Billed monthly • Active since Jan {new Date().getFullYear()}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 pt-8 border-t border-slate-100">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  Pricing
                </p>
                <p className="text-xl font-bold text-slate-900">
                  $49
                  <span className="text-sm font-normal text-slate-500">
                    /mo
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  Next Invoice
                </p>
                <p className="text-lg font-bold text-slate-900">
                  Feb 1, {new Date().getFullYear() + 1}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  Users
                </p>
                <p className="text-lg font-bold text-slate-900">
                  Up to 25 seats
                </p>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                Payment Methods
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              >
                Add New
              </Button>
            </div>
            <div className="p-8">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-slate-200 rounded-md flex items-center justify-center font-bold text-[10px] text-slate-500">
                    VISA
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Visa ending in 4242
                    </p>
                    <p className="text-xs text-slate-500 text-slate-500">
                      Expires 12/28 • Default
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Secure Billing
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              All transactions are processed securely via our 3rd party payment
              processor. We do not store your full card details on our servers.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                256-bit SSL Encryption
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                PCI DSS Compliant
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Recent Activity
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        Invoice #TRN-{new Date().getFullYear() - i}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Jan {i}, {new Date().getFullYear()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    $49.00
                  </span>
                </div>
              ))}
              <Button
                variant="ghost"
                className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 mt-2"
              >
                View All Invoices
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
