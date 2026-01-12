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
  CheckCircle2,
  Mail,
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
  // Billing / Provider IDs
  umpi: z.string().optional(), // Unique Minnesota Provider Identifier
  npi: z.string().optional(), // National Provider Identifier
  // Legacy fields
  license_number: z.string().optional(),
  vehicle_info: z.string().optional(),
  notes: z.string().optional(),
  // System invitation
  send_invite: z.boolean().optional(),
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [lastInviteEmail, setLastInviteEmail] = useState("");

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
          send_invite: true,
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

      // Handle invitation if requested and email is provided
      const shouldSendInvite =
        data.send_invite && data.email && !initialData?.id;

      if (shouldSendInvite) {
        // Create invitation for driver role
        const { error: inviteError } = await supabase
          .from("org_invites")
          .insert({
            org_id: currentOrganization.id,
            email: data.email,
            role: "driver" as any,
            invited_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (inviteError) {
          if (inviteError.code === "23505") {
            throw new Error("An invitation for this email already exists.");
          }
          throw inviteError;
        }
      }

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

      // Show success screen if invite was sent
      if (shouldSendInvite) {
        const { data: inviteData } = await supabase
          .from("org_invites")
          .select("token")
          .eq("org_id", currentOrganization.id)
          .eq("email", data.email)
          .is("accepted_at", null)
          .single();

        setInviteToken(inviteData?.token || null);
        setLastInviteEmail(data.email || "");
        setShowSuccess(true);
      } else {
        // Reset form and close
        handleClose();
      }
    } catch (err) {
      console.error("Failed to save driver:", err);
      alert(err instanceof Error ? err.message : "Failed to save driver");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCustomFields([]);
    setCurrentStep(1);
    setShowSuccess(false);
    setInviteToken(null);
    setLastInviteEmail("");
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
          "license_number",
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
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col">
        {showSuccess ? (
          <div className="p-8 text-center space-y-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                Driver Added & Invite Sent!
              </h2>
              <p className="text-sm text-slate-500">
                An invitation email has been sent to{" "}
                <strong>{lastInviteEmail}</strong>.
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-left">
              <p className="text-xs text-slate-500 mb-2">
                The driver will be able to:
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-600" />
                  View their assigned trips
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-600" />
                  See trip details and patient information
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-600" />
                  Access the driver mobile experience
                </li>
              </ul>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <code className="text-[10px] flex-1 truncate text-left">
                {`${window.location.origin}${
                  import.meta.env.BASE_URL
                }?page=accept-invite&token=${inviteToken}`}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  const url = `${window.location.origin}${
                    import.meta.env.BASE_URL
                  }?page=accept-invite&token=${inviteToken}`;
                  navigator.clipboard.writeText(url);
                  alert("Copied!");
                }}
              >
                Copy
              </Button>
            </div>
            <Button onClick={handleClose} className="w-full bg-[#3D5A3D]">
              Done
            </Button>
          </div>
        ) : (
          <>
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
            <div className="px-3 sm:px-5 py-3 border-b bg-slate-50 shrink-0 overflow-x-auto scrollbar-hide">
              <div className="flex items-center justify-between min-w-max">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        {...register("full_name")}
                        placeholder="Michael Chen"
                        className={cn(
                          "h-9",
                          errors.full_name && "border-red-500"
                        )}
                      />
                      {errors.full_name && (
                        <p className="text-xs text-red-500">
                          {errors.full_name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        License Number
                      </label>
                      <Input
                        {...register("license_number")}
                        placeholder="DL-123456789"
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                          setValue("phone", formatted, {
                            shouldValidate: true,
                          });
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                          <span className="font-medium">FOLDED WHEELCHAIR</span>{" "}
                          - Can fold wheelchair
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />
                        <div>
                          <span className="font-medium">WHEELCHAIR</span> -
                          Standard Wheelchair
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                  {/* Provider IDs for Medicaid Billing */}
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4 text-emerald-600"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                        />
                      </svg>
                      Medicaid Provider IDs
                      <span className="text-xs text-slate-400 ml-auto font-normal">
                        (For 837P billing)
                      </span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          UMPI
                          <span className="text-xs text-slate-400 ml-2 font-normal">
                            (Minnesota only)
                          </span>
                        </label>
                        <Input
                          {...register("umpi")}
                          placeholder="e.g., UMPI123456"
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          NPI
                          <span className="text-xs text-slate-400 ml-2 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <Input
                          {...register("npi")}
                          placeholder="e.g., 1234567890"
                          maxLength={10}
                          className="h-9"
                        />
                      </div>
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
                                updateCustomField(
                                  index,
                                  "value",
                                  e.target.value
                                )
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

                  {/* System Invitation Section - Only for new drivers */}
                  {!initialData && (
                    <div className="border-t border-slate-200 pt-4 mt-4">
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Mail className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-slate-900">
                                Send System Invitation
                              </h4>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  {...register("send_invite")}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#3D5A3D]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3D5A3D]"></div>
                              </label>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              When enabled, an invitation email will be sent to
                              the driver's email address. They'll be able to log
                              in and view their assigned trips.
                            </p>
                            {!errors.email && (
                              <p className="text-[10px] text-blue-600 mt-2 italic">
                                Requires a valid email address in Step 1.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
