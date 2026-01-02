import { useState, useEffect } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  User,
  Car,
  Shield,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";

// Vehicle type options
const VEHICLE_TYPES = [
  { value: "common_carrier", label: "Common Carrier" },
  { value: "folded_wheelchair", label: "Folded Wheelchair" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "van", label: "Van" },
] as const;

// Schema for driver form
const driverSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  id_number: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Invalid phone format (555) 555-5555")
    .optional()
    .or(z.literal("")),
  address: z.string().optional(),
  county: z.string().optional(),
  // Vehicle info
  vehicle_type: z.string().optional(),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_color: z.string().optional(),
  license_plate: z.string().optional(),
  // Compliance
  dot_medical_number: z.string().optional(),
  dot_medical_expiration: z.string().optional(),
  insurance_company: z.string().optional(),
  insurance_policy_number: z.string().optional(),
  insurance_start_date: z.string().optional(),
  insurance_expiration_date: z.string().optional(),
  inspection_date: z.string().optional(),
  driver_record_issue_date: z.string().optional(),
  driver_record_expiration: z.string().optional(),
  // Legacy fields
  license_number: z.string().optional(),
  vehicle_info: z.string().optional(),
  notes: z.string().optional(),
});

interface DriverFormData extends z.infer<typeof driverSchema> {
  id?: string;
}

interface CustomField {
  key: string;
  value: string;
}

interface DriverFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: DriverFormData & {
    custom_fields?: Record<string, string> | null;
  };
}

// Step configuration
const STEPS = [
  {
    id: 1,
    title: "Personal Info",
    icon: User,
    description: "Contact details",
  },
  { id: 2, title: "Vehicle", icon: Car, description: "Vehicle information" },
  { id: 3, title: "Compliance", icon: Shield, description: "Documentation" },
  { id: 4, title: "Notes", icon: FileText, description: "Additional info" },
];

export function DriverForm({
  open,
  onOpenChange,
  initialData,
}: DriverFormProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
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
    trigger,
    formState: { errors },
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    values: initialData
      ? {
          full_name: initialData.full_name,
          id_number: initialData.id_number || "",
          email: initialData.email || "",
          phone: initialData.phone ? formatPhoneNumber(initialData.phone) : "",
          address: initialData.address || "",
          county: initialData.county || "",
          vehicle_type: initialData.vehicle_type || "",
          vehicle_make: initialData.vehicle_make || "",
          vehicle_model: initialData.vehicle_model || "",
          vehicle_color: initialData.vehicle_color || "",
          license_plate: initialData.license_plate || "",
          dot_medical_number: initialData.dot_medical_number || "",
          dot_medical_expiration: initialData.dot_medical_expiration || "",
          insurance_company: initialData.insurance_company || "",
          insurance_policy_number: initialData.insurance_policy_number || "",
          insurance_start_date: initialData.insurance_start_date || "",
          insurance_expiration_date:
            initialData.insurance_expiration_date || "",
          inspection_date: initialData.inspection_date || "",
          driver_record_issue_date: initialData.driver_record_issue_date || "",
          driver_record_expiration: initialData.driver_record_expiration || "",
          license_number: initialData.license_number || "",
          vehicle_info: initialData.vehicle_info || "",
          notes: initialData.notes || "",
        }
      : {
          full_name: "",
          id_number: "",
          email: "",
          phone: "",
          address: "",
          county: "",
          vehicle_type: "",
          vehicle_make: "",
          vehicle_model: "",
          vehicle_color: "",
          license_plate: "",
          dot_medical_number: "",
          dot_medical_expiration: "",
          insurance_company: "",
          insurance_policy_number: "",
          insurance_start_date: "",
          insurance_expiration_date: "",
          inspection_date: "",
          driver_record_issue_date: "",
          driver_record_expiration: "",
          license_number: "",
          vehicle_info: "",
          notes: "",
        },
  });

  // Reset step when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
    }
  }, [open]);

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

  const onSubmit = async (data: DriverFormData) => {
    if (!currentOrganization) return;

    setIsSubmitting(true);

    try {
      const fieldsObj: Record<string, string> = {};
      customFields.forEach((cf) => {
        if (cf.key.trim()) {
          fieldsObj[cf.key.trim()] = cf.value;
        }
      });

      const driverData = {
        org_id: currentOrganization.id,
        full_name: data.full_name,
        id_number: data.id_number || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        county: data.county || null,
        vehicle_type: data.vehicle_type || null,
        vehicle_make: data.vehicle_make || null,
        vehicle_model: data.vehicle_model || null,
        vehicle_color: data.vehicle_color || null,
        license_plate: data.license_plate || null,
        dot_medical_number: data.dot_medical_number || null,
        dot_medical_expiration: data.dot_medical_expiration || null,
        insurance_company: data.insurance_company || null,
        insurance_policy_number: data.insurance_policy_number || null,
        insurance_start_date: data.insurance_start_date || null,
        insurance_expiration_date: data.insurance_expiration_date || null,
        inspection_date: data.inspection_date || null,
        driver_record_issue_date: data.driver_record_issue_date || null,
        driver_record_expiration: data.driver_record_expiration || null,
        license_number: data.license_number || null,
        vehicle_info: data.vehicle_info || null,
        notes: data.notes || null,
        custom_fields: Object.keys(fieldsObj).length > 0 ? fieldsObj : null,
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("drivers")
          .update(driverData)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("drivers").insert(driverData);
        if (error) throw error;
      }

      // Invalidate and refetch drivers
      await queryClient.invalidateQueries({
        queryKey: ["drivers", currentOrganization.id],
      });

      // Reset form and close
      handleClose();
    } catch (err) {
      console.error("Failed to save driver:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCustomFields([]);
    setCurrentStep(1);
    onOpenChange(false);
  };

  const handleNext = async () => {
    // Validate current step fields before proceeding
    let fieldsToValidate: (keyof DriverFormData)[] = [];

    switch (currentStep) {
      case 1:
        fieldsToValidate = [
          "full_name",
          "email",
          "phone",
          "id_number",
          "address",
          "county",
        ];
        break;
      case 2:
        fieldsToValidate = [
          "vehicle_type",
          "vehicle_make",
          "vehicle_model",
          "vehicle_color",
          "license_plate",
        ];
        break;
      case 3:
        fieldsToValidate = [
          "dot_medical_number",
          "dot_medical_expiration",
          "insurance_company",
          "insurance_policy_number",
          "insurance_start_date",
          "insurance_expiration_date",
          "inspection_date",
          "driver_record_issue_date",
          "driver_record_expiration",
        ];
        break;
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold text-slate-900">
            {initialData ? "Edit Driver" : "Add New Driver"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {initialData
              ? "Update the driver's information below."
              : "Enter the driver's information below."}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="px-5 py-3 border-b bg-slate-50 shrink-0">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted) setCurrentStep(step.id);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all",
                      isActive && "bg-[#3D5A3D] text-white",
                      isCompleted &&
                        "bg-[#3D5A3D]/10 text-[#3D5A3D] hover:bg-[#3D5A3D]/20 cursor-pointer",
                      !isActive &&
                        !isCompleted &&
                        "text-slate-400 cursor-not-allowed"
                    )}
                    disabled={!isCompleted && !isActive}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                        isActive && "bg-white/20 scale-110",
                        isCompleted && "bg-[#3D5A3D] text-white",
                        !isActive && !isCompleted && "bg-slate-200"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    {isActive && (
                      <span className="text-xs font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                        {step.title}
                      </span>
                    )}
                  </button>
                  {index < STEPS.length - 1 && (
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 mx-1",
                        isCompleted ? "text-[#3D5A3D]" : "text-slate-300"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto p-5"
        >
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-[#3D5A3D]" />
                Personal Information
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    {...register("full_name")}
                    placeholder="Michael Chen"
                    className={cn("h-9", errors.full_name && "border-red-500")}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-red-500">
                      {errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    ID Number
                  </label>
                  <Input
                    {...register("id_number")}
                    placeholder="DL-123456789"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="driver@company.com"
                    className={cn("h-9", errors.email && "border-red-500")}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
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
                    className={cn("h-9", errors.phone && "border-red-500")}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Address
                  </label>
                  <Input
                    {...register("address")}
                    placeholder="123 Main St, City, State ZIP"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    County
                  </label>
                  <Input
                    {...register("county")}
                    placeholder="County name"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Vehicle Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Car className="w-4 h-4 text-[#3D5A3D]" />
                Vehicle Information
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("vehicle_type")}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                  >
                    <option value="">Select vehicle type</option>
                    {VEHICLE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Determines which patients can be assigned
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    License Plate #
                  </label>
                  <Input
                    {...register("license_plate")}
                    placeholder="ABC-1234"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Make
                  </label>
                  <Input
                    {...register("vehicle_make")}
                    placeholder="Toyota"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Model
                  </label>
                  <Input
                    {...register("vehicle_model")}
                    placeholder="Sienna"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Color
                  </label>
                  <Input
                    {...register("vehicle_color")}
                    placeholder="White"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <h4 className="text-sm font-medium text-slate-700 mb-2">
                  Vehicle Type Guide
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <span className="font-medium">COMMON CARRIER</span> -
                      Ambulatory / Standard
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    <div>
                      <span className="font-medium">FOLDED WHEELCHAIR</span> -
                      Can fold wheelchair
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />
                    <div>
                      <span className="font-medium">WHEELCHAIR</span> - Standard
                      Wheelchair
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                    <div>
                      <span className="font-medium">VAN</span> - Van / Ramp
                      Service
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Compliance & Documentation */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#3D5A3D]" />
                Compliance & Documentation
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    DOT Medical #
                  </label>
                  <Input
                    {...register("dot_medical_number")}
                    placeholder="DOT-123456"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    DOT Medical Expiration
                  </label>
                  <Input
                    {...register("dot_medical_expiration")}
                    type="date"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Insurance Company
                  </label>
                  <Input
                    {...register("insurance_company")}
                    placeholder="State Farm"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Insurance Policy #
                  </label>
                  <Input
                    {...register("insurance_policy_number")}
                    placeholder="POL-123456"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Insurance Start Date
                  </label>
                  <Input
                    {...register("insurance_start_date")}
                    type="date"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Insurance Expiration
                  </label>
                  <Input
                    {...register("insurance_expiration_date")}
                    type="date"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Inspection Date
                  </label>
                  <Input
                    {...register("inspection_date")}
                    type="date"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Driver Record Issue
                  </label>
                  <Input
                    {...register("driver_record_issue_date")}
                    type="date"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Record Expiration
                  </label>
                  <Input
                    {...register("driver_record_expiration")}
                    type="date"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Notes & Custom Fields */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3D5A3D]" />
                Notes & Additional Information
              </h3>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Notes / Special Instructions
                </label>
                <textarea
                  {...register("notes")}
                  placeholder="Add any specific details about the driver..."
                  className="w-full min-h-[80px] rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                />
              </div>

              {/* Custom Fields Section */}
              <div className="border-t border-slate-200 pt-4 mt-4">
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
                    className="gap-1 h-8"
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
                          className="flex-1 h-9"
                        />
                        <Input
                          placeholder="Value"
                          value={cf.value}
                          onChange={(e) =>
                            updateCustomField(index, "value", e.target.value)
                          }
                          className="flex-1 h-9"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomField(index)}
                          className="text-slate-400 hover:text-red-500 h-9 w-9 p-0"
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
            </div>
          )}
        </form>

        {/* Footer with Navigation */}
        <DialogFooter className="p-5 border-t flex items-center justify-between gap-3 shrink-0">
          <div className="text-sm text-slate-500">
            Step {currentStep} of {STEPS.length}
          </div>
          <div className="flex gap-3">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {currentStep === 1 && (
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}
            {currentStep < STEPS.length && (
              <Button
                type="button"
                onClick={handleNext}
                className="bg-[#3D5A3D] hover:bg-[#2E4A2E] gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {currentStep === STEPS.length && (
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
                  "Add Driver"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
