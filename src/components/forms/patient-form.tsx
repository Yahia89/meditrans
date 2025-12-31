import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";

// Vehicle type need options for patients
const VEHICLE_TYPE_NEEDS = [
  { value: "ambulatory", label: "Ambulatory (Can walk)" },
  { value: "folded_wheelchair", label: "Folded Wheelchair" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "stretcher", label: "Stretcher" },
] as const;

// Schema for patient form
const patientSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Invalid phone format (555) 555-5555")
    .optional()
    .or(z.literal("")),
  dob: z.string().optional(),
  primary_address: z.string().optional(),
  county: z.string().optional(),
  // Service & Referral
  waiver_type: z.string().optional(),
  referral_by: z.string().optional(),
  referral_date: z.string().optional(),
  referral_expiration_date: z.string().optional(),
  service_type: z.string().optional(),
  // Case Management
  case_manager: z.string().optional(),
  case_manager_phone: z.string().optional(),
  // Billing
  monthly_credit: z.string().optional(),
  credit_used_for: z.string().optional(),
  // Transportation
  vehicle_type_need: z.string().optional(),
  notes: z.string().optional(),
  // Legacy
  date_of_birth: z.string().optional(),
});

interface PatientFormData extends z.infer<typeof patientSchema> {
  id?: string;
}

interface CustomField {
  key: string;
  value: string;
}

interface PatientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: PatientFormData & {
    custom_fields?: Record<string, string> | null;
  };
}

export function PatientForm({
  open,
  onOpenChange,
  initialData,
}: PatientFormProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    if (initialData?.custom_fields) {
      return Object.entries(initialData.custom_fields).map(([key, value]) => ({
        key,
        value,
      }));
    }
    return [];
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    values: initialData
      ? {
          full_name: initialData.full_name,
          email: initialData.email || "",
          phone: initialData.phone ? formatPhoneNumber(initialData.phone) : "",
          dob: initialData.dob || initialData.date_of_birth || "",
          primary_address: initialData.primary_address || "",
          county: initialData.county || "",
          waiver_type: initialData.waiver_type || "",
          referral_by: initialData.referral_by || "",
          referral_date: initialData.referral_date || "",
          referral_expiration_date: initialData.referral_expiration_date || "",
          service_type: initialData.service_type || "",
          case_manager: initialData.case_manager || "",
          case_manager_phone: initialData.case_manager_phone || "",
          monthly_credit: initialData.monthly_credit?.toString() || "",
          credit_used_for: initialData.credit_used_for || "",
          vehicle_type_need: initialData.vehicle_type_need || "",
          notes: initialData.notes || "",
        }
      : {
          full_name: "",
          email: "",
          phone: "",
          dob: "",
          primary_address: "",
          county: "",
          waiver_type: "",
          referral_by: "",
          referral_date: "",
          referral_expiration_date: "",
          service_type: "",
          case_manager: "",
          case_manager_phone: "",
          monthly_credit: "",
          credit_used_for: "",
          vehicle_type_need: "",
          notes: "",
        },
  });

  const addCustomField = () => {
    setCustomFields([...customFields, { key: "", value: "" }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const onSubmit = async (data: PatientFormData) => {
    if (!currentOrganization) return;

    setIsSubmitting(true);

    try {
      const fieldsObj: Record<string, string> = {};
      customFields.forEach((cf) => {
        if (cf.key.trim()) {
          fieldsObj[cf.key.trim()] = cf.value;
        }
      });

      const patientData = {
        org_id: currentOrganization.id,
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        dob: data.dob || null,
        date_of_birth: data.dob || null, // Legacy field
        primary_address: data.primary_address || null,
        county: data.county || null,
        waiver_type: data.waiver_type || null,
        referral_by: data.referral_by || null,
        referral_date: data.referral_date || null,
        referral_expiration_date: data.referral_expiration_date || null,
        service_type: data.service_type || null,
        case_manager: data.case_manager || null,
        case_manager_phone: data.case_manager_phone || null,
        monthly_credit: data.monthly_credit
          ? parseFloat(data.monthly_credit)
          : null,
        credit_used_for: data.credit_used_for || null,
        vehicle_type_need: data.vehicle_type_need || null,
        notes: data.notes || null,
        custom_fields: Object.keys(fieldsObj).length > 0 ? fieldsObj : null,
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("patients")
          .update(patientData)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("patients").insert(patientData);
        if (error) throw error;
      }

      // Invalidate and refetch patients
      await queryClient.invalidateQueries({
        queryKey: ["patients", currentOrganization.id],
      });
      if (initialData?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["patient", initialData.id],
        });
      }

      // Reset form and close
      handleClose();
    } catch (err) {
      console.error("Failed to save patient:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCustomFields([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {initialData ? "Edit Patient" : "Add New Patient"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the patient's information below."
              : "Enter the patient's information below."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 p-6 pt-4"
          >
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider border-b pb-2">
                Basic Information
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    {...register("full_name")}
                    placeholder="John Smith"
                    className={cn(errors.full_name && "border-red-500")}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-red-500">
                      {errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Date of Birth
                  </label>
                  <Input {...register("dob")} type="date" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="patient@email.com"
                    className={cn(errors.email && "border-red-500")}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <Input
                    {...register("phone")}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setValue("phone", formatted, { shouldValidate: true });
                    }}
                    placeholder="(555) 123-4567"
                    className={cn(errors.phone && "border-red-500")}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Address
                  </label>
                  <Input
                    {...register("primary_address")}
                    placeholder="123 Main St, City, State ZIP"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    County
                  </label>
                  <Input {...register("county")} placeholder="County name" />
                </div>
              </div>
            </div>

            {/* Transportation Needs Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider border-b pb-2">
                Transportation Needs
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Vehicle Type Needed <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("vehicle_type_need")}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                  >
                    <option value="">Select type needed</option>
                    {VEHICLE_TYPE_NEEDS.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Used to match with compatible drivers
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Service Type
                  </label>
                  <Input
                    {...register("service_type")}
                    placeholder="e.g., Medical, Personal"
                  />
                </div>
              </div>
            </div>

            {/* Service & Referral Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider border-b pb-2">
                Service & Referral
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Waiver Type
                  </label>
                  <Input
                    {...register("waiver_type")}
                    placeholder="Waiver type"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Referred By
                  </label>
                  <Input
                    {...register("referral_by")}
                    placeholder="Referral source"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Referral Date
                  </label>
                  <Input {...register("referral_date")} type="date" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Referral Expiration
                  </label>
                  <Input
                    {...register("referral_expiration_date")}
                    type="date"
                  />
                </div>
              </div>
            </div>

            {/* Case Management Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider border-b pb-2">
                Case Management
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Case Manager Name
                  </label>
                  <Input
                    {...register("case_manager")}
                    placeholder="Case manager name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Case Manager Phone
                  </label>
                  <Input
                    {...register("case_manager_phone")}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Billing Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider border-b pb-2">
                Billing & Credits
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Monthly Credit ($)
                  </label>
                  <Input
                    {...register("monthly_credit")}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Credit Used For
                  </label>
                  <Input
                    {...register("credit_used_for")}
                    placeholder="e.g., Medical appointments only"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                {...register("notes")}
                placeholder="Any additional notes about the patient..."
                className="w-full min-h-[80px] rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
              />
            </div>

            {/* Custom Fields Section */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-slate-900">
                    Custom Fields
                  </h4>
                  <p className="text-xs text-slate-500">
                    Add organization-specific data
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomField}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Field
                </Button>
              </div>

              {customFields.length > 0 && (
                <div className="space-y-2">
                  {customFields.map((cf, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="Field name"
                        value={cf.key}
                        onChange={(e) =>
                          updateCustomField(index, "key", e.target.value)
                        }
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value"
                        value={cf.value}
                        onChange={(e) =>
                          updateCustomField(index, "value", e.target.value)
                        }
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomField(index)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {customFields.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  No custom fields added. Click "Add Field" to create
                  organization-specific fields.
                </p>
              )}
            </div>
          </form>
        </ScrollArea>

        <div className="p-6 border-t flex justify-end gap-3 shrink-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
            className="bg-[#3D5A3D] hover:bg-[#2E4A2E]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {initialData ? "Saving..." : "Adding..."}
              </>
            ) : initialData ? (
              "Save Changes"
            ) : (
              "Add Patient"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
