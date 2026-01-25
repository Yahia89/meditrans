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
  Truck,
  FileText,
  Briefcase,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Check,
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
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Google Maps API
  const { isLoaded } = useLoadScript({
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
          case_manager: initialData.case_manager || "",
          case_manager_phone: initialData.case_manager_phone || "",
          case_manager_email: initialData.case_manager_email || "",
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
          case_manager_email: "",
          monthly_credit: "",
          credit_used_for: "",
          vehicle_type_need: "",
          notes: "",
        },
  });

  const watchedServiceType = watch("service_type");
  const watchedReferralBy = watch("referral_by");

  // Local state for 'Other' type-in fields
  const [otherServiceType, setOtherServiceType] = useState("");
  const [otherReferralBy, setOtherReferralBy] = useState("");

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

    setIsSubmitting(true);

    try {
      const fieldsObj: Record<string, string> = {};
      customFields.forEach((cf) => {
        if (cf.key.trim()) {
          fieldsObj[cf.key.trim()] = cf.value;
        }
      });

      // Format patient phone to include +1 for SMS compatibility
      let formattedPhone = data.phone;
      if (data.phone) {
        const cleaned = data.phone.replace(/[^\d]/g, "");
        if (cleaned.length === 10) {
          formattedPhone = `+1${cleaned}`;
        } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
          formattedPhone = `+${cleaned}`;
        }
      }

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
        case_manager: data.case_manager || null,
        case_manager_phone: data.case_manager_phone || null,
        case_manager_email: data.case_manager_email || null,
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
          className="flex-1 overflow-y-auto p-5"
        >
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
                    Vehicle Type Needed <span className="text-red-500">*</span>
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
                      const formatted = formatPhoneNumber(e.target.value);
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
                  "Add Patient"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
