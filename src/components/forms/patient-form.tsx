import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
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
  Truck,
  FileText,
  Briefcase,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  ShieldAlert,
  ClipboardCheck,
  Clock,
  XCircle,
  History,
  CheckCircle2,
  MinusCircle,
} from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useLoadScript } from "@react-google-maps/api";
import { AddressAutocomplete } from "@/components/trips/AddressAutocomplete";

// Libraries must be defined outside component to avoid re-loading
const GOOGLE_MAPS_LIBRARIES: (
  | "places"
  | "geometry"
  | "drawing"
  | "visualization"
)[] = ["places"];

// Vehicle type need options for patients
import {
  VEHICLE_TYPE_NEEDS,
  WAIVER_TYPES,
  REFERRAL_SOURCES,
  SERVICE_TYPES,
} from "@/lib/constants";

// Schema for patient form
// Column mapping: CLIENT NAME, DOB, PHONE NUMBER, ADDRESS, WAIVER TYPE, COUNTY,
// REFERRAL BY, MONTHLY CREDIT, CASE MANAGER NAME, SERVICE TYPE, CASE MANAGER PHONE,
// CASE MANAGER EMAIL, VEHICLE NEED, REFERRAL EXPIRATION, NOTES
const patientSchema = z.object({
  full_name: z.string().min(2, "Client name must be at least 2 characters"), // CLIENT NAME
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z // PHONE NUMBER
    .string()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Invalid phone format (555) 555-5555")
    .optional()
    .or(z.literal("")),
  dob: z.string().optional(), // DOB
  primary_address: z.string().optional(), // ADDRESS
  county: z.string().optional(), // COUNTY
  // Service & Referral
  waiver_type: z.string().optional(), // WAIVER TYPE
  referral_by: z.string().optional(), // REFERRAL BY
  referral_date: z.string().optional(),
  referral_expiration_date: z.string().optional(), // REFERRAL EXPIRATION
  service_type: z.string().optional(), // SERVICE TYPE
  // SAL (Service Agreement Letter)
  sal_status: z.string().min(1, "SAL status is required"),
  sal_effective_date: z.string().optional(),
  sal_through_date: z.string().optional(),
  sal_pending_reason: z.string().optional(),
  // Case Management
  case_manager: z.string().optional(), // CASE MANAGER NAME
  case_manager_phone: z.string().optional(), // CASE MANAGER PHONE (also labeled PHONE NUMBER)
  case_manager_email: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal("")), // CASE MANAGER EMAIL
  // Billing
  monthly_credit: z.string().optional(), // MONTHLY CREDIT
  credit_used_for: z.string().optional(),
  medicaid_id: z.string().optional(), // MEDICAID ID for 837P billing
  // Transportation
  vehicle_type_need: z.string().optional(), // VEHICLE NEED
  notes: z.string().optional(), // NOTES
  // Legacy
  date_of_birth: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.sal_status === "approved" && !data.sal_effective_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Effective date is required when SAL is approved",
      path: ["sal_effective_date"],
    });
  }
  if (data.sal_status === "pending" && !data.sal_pending_reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reason is required when SAL is pending",
      path: ["sal_pending_reason"],
    });
  }
});

// SAL History entry type
interface SalHistoryEntry {
  id: string;
  status: string;
  effective_date: string | null;
  through_date: string | null;
  pending_reason: string | null;
  changed_by_name: string | null;
  created_at: string;
  notes: string | null;
}

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
    sal_status?: string | null;
    sal_effective_date?: string | null;
    sal_through_date?: string | null;
    sal_pending_reason?: string | null;
  };
}

// Step configuration
const STEPS = [
  { id: 1, title: "Basic Info", icon: User, description: "Personal details" },
  {
    id: 2,
    title: "Transportation",
    icon: Truck,
    description: "Vehicle needs",
  },
  {
    id: 3,
    title: "Service & Referral",
    icon: FileText,
    description: "Referral info",
  },
  {
    id: 4,
    title: "Case Management",
    icon: Briefcase,
    description: "Case manager",
  },
  {
    id: 5,
    title: "Billing & Notes",
    icon: CreditCard,
    description: "Additional info",
  },
];

export function PatientForm({
  open,
  onOpenChange,
  initialData,
}: PatientFormProps) {
  const { currentOrganization } = useOrganization();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { canEditPatients, canViewBilling, canViewMedicaid } = usePermissions();

  // Load Google Maps API
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

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
    watch,
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
          sal_status: initialData.sal_status || "",
          sal_effective_date: initialData.sal_effective_date || "",
          sal_through_date: initialData.sal_through_date || "",
          sal_pending_reason: initialData.sal_pending_reason || "",
          case_manager: initialData.case_manager || "",
          case_manager_phone: initialData.case_manager_phone || "",
          case_manager_email: initialData.case_manager_email || "",
          monthly_credit: initialData.monthly_credit?.toString() || "",
          credit_used_for: initialData.credit_used_for || "",
          medicaid_id: initialData.medicaid_id || "",
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
          sal_status: "",
          sal_effective_date: "",
          sal_through_date: "",
          sal_pending_reason: "",
          case_manager: "",
          case_manager_phone: "",
          case_manager_email: "",
          monthly_credit: "",
          credit_used_for: "",
          medicaid_id: "",
          vehicle_type_need: "",
          notes: "",
        },
  });

  const watchedServiceType = watch("service_type");
  const watchedReferralBy = watch("referral_by");
  const watchedSalStatus = watch("sal_status");

  // Local state for 'Other' type-in fields
  const [otherServiceType, setOtherServiceType] = useState("");
  const [otherReferralBy, setOtherReferralBy] = useState("");

  // Fetch SAL history for editing existing patients
  const { data: salHistory = [] } = useQuery({
    queryKey: ["sal-history", initialData?.id],
    queryFn: async () => {
      if (!initialData?.id) return [];
      const { data, error } = await supabase
        .from("patient_sal_history")
        .select("*")
        .eq("patient_id", initialData.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalHistoryEntry[];
    },
    enabled: !!initialData?.id && open,
  });

  // Initialize other fields if editing
  useEffect(() => {
    if (
      initialData?.service_type &&
      !SERVICE_TYPES.includes(initialData.service_type as any)
    ) {
      setValue("service_type", "Other");
      setOtherServiceType(initialData.service_type);
    }
    if (
      initialData?.referral_by &&
      !REFERRAL_SOURCES.includes(initialData.referral_by as any)
    ) {
      setValue("referral_by", "Other");
      setOtherReferralBy(initialData.referral_by);
    }
  }, [initialData, setValue]);

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
    value: string,
  ) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const onSubmit = async (data: PatientFormData) => {
    if (!currentOrganization) return;

    // If not on the last step, just go to the next step
    // This allows the "Enter" key to act as "Next" instead of submitting the form
    if (currentStep < STEPS.length) {
      handleNext();
      return;
    }

    setIsSubmitting(true);

    try {
      const fieldsObj: Record<string, string> = {};
      customFields.forEach((cf) => {
        if (cf.key.trim()) {
          fieldsObj[cf.key.trim()] = cf.value;
        }
      });

      // Extract only digits for storage, ensuring 10 digits without +1
      const cleanedPhone = data.phone?.replace(/[^\d]/g, "") || "";
      const formattedPhone =
        cleanedPhone.length > 10 && cleanedPhone.startsWith("1")
          ? cleanedPhone.slice(cleanedPhone.length - 10)
          : cleanedPhone.slice(0, 10);

      // Same for case manager phone
      const cleanedCMPPhone =
        data.case_manager_phone?.replace(/[^\d]/g, "") || "";
      const formattedCMPPhone =
        cleanedCMPPhone.length > 10 && cleanedCMPPhone.startsWith("1")
          ? cleanedCMPPhone.slice(cleanedCMPPhone.length - 10)
          : cleanedCMPPhone.slice(0, 10);

      const patientData = {
        org_id: currentOrganization.id,
        full_name: data.full_name,
        email: data.email || null,
        phone: formattedPhone || null,
        dob: data.dob || null,
        date_of_birth: data.dob || null, // Legacy field
        primary_address: data.primary_address || null,
        county: data.county || null,
        waiver_type: data.waiver_type || null,
        referral_by:
          data.referral_by === "Other"
            ? otherReferralBy
            : data.referral_by || null,
        referral_date: data.referral_date || null,
        referral_expiration_date: data.referral_expiration_date || null,
        service_type:
          data.service_type === "Other"
            ? otherServiceType
            : data.service_type || null,
        sal_status: data.sal_status || null,
        sal_effective_date: data.sal_status === "approved" ? (data.sal_effective_date || null) : null,
        sal_through_date: data.sal_status === "approved" ? (data.sal_through_date || null) : null,
        sal_pending_reason: data.sal_status === "pending" ? (data.sal_pending_reason || null) : null,
        case_manager: data.case_manager || null,
        case_manager_phone: formattedCMPPhone || null,
        case_manager_email: data.case_manager_email || null,
        monthly_credit: data.monthly_credit
          ? parseFloat(data.monthly_credit)
          : null,
        credit_used_for: data.credit_used_for || null,
        medicaid_id: data.medicaid_id || null,
        vehicle_type_need: data.vehicle_type_need || null,
        notes: data.notes || null,
        custom_fields: Object.keys(fieldsObj).length > 0 ? fieldsObj : null,
      };

      // Determine if SAL status changed (for history logging)
      const salStatusChanged = initialData?.id
        ? (data.sal_status || null) !== (initialData.sal_status || null)
        : !!data.sal_status;

      if (initialData?.id) {
        const { error } = await supabase
          .from("patients")
          .update(patientData)
          .eq("id", initialData.id);
        if (error) throw error;

        // Log SAL status change to history
        if (salStatusChanged && data.sal_status) {
          const { error: historyError } = await supabase
            .from("patient_sal_history")
            .insert({
              patient_id: initialData.id,
              org_id: currentOrganization.id,
              status: data.sal_status,
              effective_date: data.sal_status === "approved" ? (data.sal_effective_date || null) : null,
              through_date: data.sal_status === "approved" ? (data.sal_through_date || null) : null,
              pending_reason: data.sal_status === "pending" ? (data.sal_pending_reason || null) : null,
              changed_by: user?.id || null,
              changed_by_name: profile?.full_name || "Unknown",
            });
          if (historyError) console.error("Failed to log SAL history:", historyError);
        }
      } else {
        const { data: insertedPatient, error } = await supabase.from("patients").insert(patientData).select("id").single();
        if (error) throw error;

        // Log initial SAL status for new patient
        if (insertedPatient && data.sal_status) {
          const { error: historyError } = await supabase
            .from("patient_sal_history")
            .insert({
              patient_id: insertedPatient.id,
              org_id: currentOrganization.id,
              status: data.sal_status,
              effective_date: data.sal_status === "approved" ? (data.sal_effective_date || null) : null,
              through_date: data.sal_status === "approved" ? (data.sal_through_date || null) : null,
              pending_reason: data.sal_status === "pending" ? (data.sal_pending_reason || null) : null,
              changed_by: user?.id || null,
              changed_by_name: profile?.full_name || "Unknown",
            });
          if (historyError) console.error("Failed to log SAL history:", historyError);
        }
      }

      // Invalidate and refetch patients
      await queryClient.invalidateQueries({
        queryKey: ["patients", currentOrganization.id],
      });
      if (initialData?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["patient", initialData.id],
        });
        await queryClient.invalidateQueries({
          queryKey: ["sal-history", initialData.id],
        });
      }

      // Reset form and close
      handleClose();
    } catch (err) {
      console.error("Failed to save patient:", err);
      alert(err instanceof Error ? err.message : "Failed to save patient");
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
    let fieldsToValidate: (keyof PatientFormData)[] = [];

    switch (currentStep) {
      case 1:
        fieldsToValidate = [
          "full_name",
          "email",
          "phone",
          "dob",
          "primary_address",
          "county",
        ];
        break;
      case 2:
        fieldsToValidate = ["vehicle_type_need", "service_type"];
        break;
      case 3:
        fieldsToValidate = [
          "waiver_type",
          "referral_by",
          "referral_date",
          "referral_expiration_date",
          "sal_status",
          "sal_effective_date",
          "sal_through_date",
          "sal_pending_reason",
        ];
        break;
      case 4:
        fieldsToValidate = [
          "case_manager",
          "case_manager_phone",
          "case_manager_email",
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
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold text-slate-900">
            {initialData ? "Edit Patient" : "Add New Patient"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {initialData
              ? "Update the patient's information below."
              : "Enter the patient's information below."}
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
                        "text-slate-400 cursor-not-allowed",
                    )}
                    disabled={!isCompleted && !isActive}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                        isActive && "bg-white/20 scale-110",
                        isCompleted && "bg-[#3D5A3D] text-white",
                        !isActive && !isCompleted && "bg-slate-200",
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
                        isCompleted ? "text-[#3D5A3D]" : "text-slate-300",
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
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-5">
            {/* Permission Alert */}
            {!canEditPatients && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-700">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold text-sm">View Only Access</p>
                  <p className="text-xs mt-1">
                    You do not have permission to modify patient records.
                  </p>
                </div>
              </div>
            )}

            {/* Google Maps Error Alert */}
            {loadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold text-sm">
                    Google Maps failed to load
                  </p>
                  <p className="text-xs mt-1">
                    {loadError.message ||
                      "Please check your API key configuration."}
                  </p>
                </div>
              </div>
            )}
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#3D5A3D]" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      {...register("full_name")}
                      placeholder="John Smith"
                      className={cn(
                        "h-9",
                        errors.full_name && "border-red-500",
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
                      Date of Birth
                    </label>
                    <Input {...register("dob")} type="date" className="h-9" />
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
                      placeholder="patient@email.com"
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
                        const digits = e.target.value
                          .replace(/[^\d]/g, "")
                          .slice(0, 10);
                        const formatted = formatPhoneNumber(digits);
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <AddressAutocomplete
                      isLoaded={isLoaded}
                      onAddressSelect={(place) => {
                        if (place.formatted_address) {
                          setValue("primary_address", place.formatted_address, {
                            shouldValidate: true,
                          });
                          // Optionally extract county/city/state etc if needed?
                          // For now just setting the full address string.
                        }
                      }}
                      {...register("primary_address")}
                      onChange={(val) => {
                        setValue("primary_address", val, {
                          shouldValidate: true,
                        });
                      }}
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

            {/* Step 2: Transportation Needs */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#3D5A3D]" />
                  Transportation Needs
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Vehicle Type Needed{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register("vehicle_type_need")}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
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
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Service Type
                    </label>
                    <select
                      {...register("service_type")}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                    >
                      <option value="">Select service type</option>
                      {SERVICE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {watchedServiceType === "Other" && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Input
                          placeholder="Please specify service type"
                          value={otherServiceType}
                          onChange={(e) => setOtherServiceType(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    )}
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

            {/* Step 3: Service & Referral */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3D5A3D]" />
                  Service & Referral Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Waiver Type
                    </label>
                    <select
                      {...register("waiver_type")}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                    >
                      <option value="">Select waiver type</option>
                      {WAIVER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Referred By
                    </label>
                    <select
                      {...register("referral_by")}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                    >
                      <option value="">Select source</option>
                      {REFERRAL_SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                    {watchedReferralBy === "Other" && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Input
                          placeholder="Please specify source"
                          value={otherReferralBy}
                          onChange={(e) => setOtherReferralBy(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Referral Date
                    </label>
                    <Input
                      {...register("referral_date")}
                      type="date"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Referral Expiration
                    </label>
                    <Input
                      {...register("referral_expiration_date")}
                      type="date"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* SAL (Service Agreement Letter) Section */}
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                    <ClipboardCheck className="w-4 h-4 text-[#3D5A3D]" />
                    Service Agreement Letter (SAL)
                    <span className="text-red-500 text-xs">*</span>
                  </h4>

                  {/* SAL Status Selector */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        SAL Status <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { value: "approved", label: "Approved", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 ring-emerald-500/20", activeBg: "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-500/30" },
                          { value: "pending", label: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200 ring-amber-500/20", activeBg: "bg-amber-100 border-amber-400 ring-2 ring-amber-500/30" },
                          { value: "expired", label: "Expired", icon: XCircle, color: "text-red-500", bg: "bg-red-50 border-red-200 ring-red-500/20", activeBg: "bg-red-100 border-red-400 ring-2 ring-red-500/30" },
                          { value: "n/a", label: "N/A", icon: MinusCircle, color: "text-slate-500", bg: "bg-slate-50 border-slate-200 ring-slate-500/20", activeBg: "bg-slate-200 border-slate-400 ring-2 ring-slate-500/30" },
                        ].map((option) => {
                          const Icon = option.icon;
                          const isActive = watchedSalStatus === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setValue("sal_status", option.value, { shouldValidate: true })}
                              className={cn(
                                "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200",
                                isActive ? option.activeBg : `${option.bg} hover:opacity-80`,
                              )}
                            >
                              <Icon className={cn("w-4 h-4", option.color)} />
                              <span className={cn(isActive ? option.color : "text-slate-600")}>
                                {option.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {errors.sal_status && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.sal_status.message}
                        </p>
                      )}
                    </div>

                    {/* Approved: Show Effective & Through dates */}
                    {watchedSalStatus === "approved" && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                        <p className="text-xs font-medium text-emerald-700 mb-3 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approval Period
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">
                              Effective Date <span className="text-red-500">*</span>
                            </label>
                            <Input
                              {...register("sal_effective_date")}
                              type="date"
                              className="h-9 bg-white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">
                              Through Date
                            </label>
                            <Input
                              {...register("sal_through_date")}
                              type="date"
                              className="h-9 bg-white"
                            />
                          </div>
                        </div>
                        {errors.sal_effective_date && (
                          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.sal_effective_date.message}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Pending: Show reason input */}
                    {watchedSalStatus === "pending" && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-4 bg-amber-50/50 rounded-lg border border-amber-100">
                        <p className="text-xs font-medium text-amber-700 mb-3 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Pending Explanation
                        </p>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-600">
                            Why is it pending? <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            {...register("sal_pending_reason")}
                            placeholder="e.g., Waiting on recertification from case manager..."
                            className="w-full min-h-[70px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                          />
                          {errors.sal_pending_reason && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.sal_pending_reason.message}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Expired: Just a note, no extra input needed */}
                    {watchedSalStatus === "expired" && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-3 bg-red-50/50 rounded-lg border border-red-100">
                        <p className="text-xs text-red-600 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          SAL has expired. The patient will need recertification to continue transporting.
                        </p>
                      </div>
                    )}

                    {/* SAL History (only when editing) */}
                    {initialData?.id && salHistory.length > 0 && (
                      <div className="border-t border-slate-100 pt-3 mt-3">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors group"
                          onClick={(e) => {
                            const target = e.currentTarget.nextElementSibling;
                            if (target) {
                              target.classList.toggle("hidden");
                              e.currentTarget.querySelector('[data-chevron]')?.classList.toggle('rotate-180');
                            }
                          }}
                        >
                          <span className="flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5" />
                            SAL Status History ({salHistory.length})
                          </span>
                          <ChevronRight data-chevron className="w-3.5 h-3.5 transition-transform rotate-90" />
                        </button>
                        <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                          {salHistory.map((entry) => (
                            <div
                              key={entry.id}
                              className={cn(
                                "flex items-start gap-3 p-2.5 rounded-lg border text-xs",
                                entry.status === "approved" && "bg-emerald-50/50 border-emerald-100",
                                entry.status === "pending" && "bg-amber-50/50 border-amber-100",
                                entry.status === "expired" && "bg-red-50/50 border-red-100",
                                entry.status === "n/a" && "bg-slate-50 border-slate-200",
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                entry.status === "approved" && "bg-emerald-100",
                                entry.status === "pending" && "bg-amber-100",
                                entry.status === "expired" && "bg-red-100",
                              )}>
                                {entry.status === "approved" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                {entry.status === "pending" && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                                {entry.status === "expired" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                                {entry.status === "n/a" && <MinusCircle className="w-3.5 h-3.5 text-slate-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn(
                                    "font-semibold capitalize",
                                    entry.status === "approved" && "text-emerald-700",
                                    entry.status === "pending" && "text-amber-700",
                                    entry.status === "expired" && "text-red-600",
                                    entry.status === "n/a" && "text-slate-600",
                                  )}>
                                    {entry.status === "n/a" ? "N/A" : entry.status}
                                  </span>
                                  <span className="text-slate-400 shrink-0">
                                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                                      month: "short", day: "numeric", year: "numeric",
                                    })}
                                  </span>
                                </div>
                                {entry.status === "approved" && entry.effective_date && (
                                  <p className="text-slate-600 mt-0.5">
                                    {new Date(entry.effective_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    <span className="mx-1.5 text-slate-400">→</span>
                                    {entry.through_date
                                      ? new Date(entry.through_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                      : "No through date"}
                                  </p>
                                )}
                                {entry.status === "pending" && entry.pending_reason && (
                                  <p className="text-slate-600 mt-0.5 line-clamp-2">
                                    {entry.pending_reason}
                                  </p>
                                )}
                                {entry.changed_by_name && (
                                  <p className="text-slate-400 mt-0.5">by {entry.changed_by_name}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Case Management */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#3D5A3D]" />
                  Case Management
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Case Manager Name
                    </label>
                    <Input
                      {...register("case_manager")}
                      placeholder="Case manager name"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Case Manager Phone
                    </label>
                    <Input
                      {...register("case_manager_phone")}
                      onChange={(e) => {
                        const digits = e.target.value
                          .replace(/[^\d]/g, "")
                          .slice(0, 10);
                        const formatted = formatPhoneNumber(digits);
                        setValue("case_manager_phone", formatted, {
                          shouldValidate: true,
                        });
                      }}
                      placeholder="(555) 123-4567"
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Case Manager Email
                  </label>
                  <Input
                    {...register("case_manager_email")}
                    type="email"
                    placeholder="casemanager@example.com"
                    className={cn(
                      "h-9",
                      errors.case_manager_email && "border-red-500",
                    )}
                  />
                  {errors.case_manager_email && (
                    <p className="text-xs text-red-500">
                      {errors.case_manager_email.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Billing & Notes */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#3D5A3D]" />
                  Billing & Additional Information
                </h3>

                {canViewBilling && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Monthly Credit ($)
                      </label>
                      <Input
                        {...register("monthly_credit")}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Credit Used For
                      </label>
                      <Input
                        {...register("credit_used_for")}
                        placeholder="e.g., Medical appointments only"
                        className="h-9"
                      />
                    </div>
                  </div>
                )}

                {canViewMedicaid && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Medicaid ID
                      <span className="text-xs text-slate-400 ml-2 font-normal">
                        (Required for Medicaid billing)
                      </span>
                    </label>
                    <Input
                      {...register("medicaid_id")}
                      placeholder="e.g., MN123456789"
                      className="h-9"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
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
          </div>

          {/* Footer with Navigation */}
          <DialogFooter className="p-5 border-t bg-slate-50 shrink-0">
            <div className="flex items-center justify-between w-full">
              <Button
                key="back-button"
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  key="cancel-button"
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                {currentStep < STEPS.length ? (
                  <Button
                    key="next-button"
                    type="button"
                    onClick={handleNext}
                    className="gap-2"
                  >
                    Next Step
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    key="submit-button"
                    type="submit"
                    disabled={isSubmitting || !canEditPatients}
                    className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white gap-2 min-w-[100px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {initialData ? "Save Changes" : "Create Patient"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
