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
  Briefcase,
  Shield,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle2,
} from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";

// Schema for employee form
const employeeSchema = z.object({
  id: z.string().optional(),
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Invalid phone format (555) 555-5555")
    .optional()
    .or(z.literal("")),
  role: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string().optional(),
  notes: z.string().optional(),
  system_role: z.string(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface CustomField {
  key: string;
  value: string;
}

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: EmployeeFormData & {
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
  {
    id: 2,
    title: "Employment",
    icon: Briefcase,
    description: "Role & Department",
  },
  {
    id: 3,
    title: "System Access",
    icon: Shield,
    description: "Permissions & Invites",
  },
  {
    id: 4,
    title: "Notes & Data",
    icon: FileText,
    description: "Custom fields",
  },
];

export function EmployeeForm({
  open,
  onOpenChange,
  initialData,
}: EmployeeFormProps) {
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
  const [hasOwner, setHasOwner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [lastInviteEmail, setLastInviteEmail] = useState("");

  // Check for existing owner
  useEffect(() => {
    if (!open || !currentOrganization) return;

    const checkOwner = async () => {
      const { count: mCount } = await supabase
        .from("organization_memberships")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrganization.id)
        .eq("role", "owner");

      const { count: iCount } = await supabase
        .from("org_invites")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrganization.id)
        .eq("role", "owner")
        .is("accepted_at", null);

      setHasOwner((mCount || 0) + (iCount || 0) > 0);
    };
    checkOwner();
  }, [open, currentOrganization]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    values: initialData
      ? {
          full_name: initialData.full_name,
          email: initialData.email || "",
          phone: initialData.phone ? formatPhoneNumber(initialData.phone) : "",
          role: initialData.role || "",
          department: initialData.department || "",
          hire_date: initialData.hire_date || "",
          notes: initialData.notes || "",
          system_role: "none",
        }
      : {
          full_name: "",
          email: "",
          phone: "",
          role: "",
          department: "",
          hire_date: "",
          notes: "",
          system_role: "none",
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

  const onSubmit = async (data: EmployeeFormData) => {
    if (!currentOrganization) return;

    setIsSubmitting(true);

    try {
      const fieldsObj: Record<string, string> = {};
      customFields.forEach((cf) => {
        if (cf.key.trim()) {
          fieldsObj[cf.key.trim()] = cf.value;
        }
      });

      if (data.system_role !== "none") {
        if (!data.email) {
          throw new Error("Email is required to invite a user to the system.");
        }

        // Check for owner limit
        if (data.system_role === "owner") {
          const { count: memberCount } = await supabase
            .from("organization_memberships")
            .select("*", { count: "exact", head: true })
            .eq("org_id", currentOrganization.id)
            .eq("role", "owner");

          const { count: inviteCount } = await supabase
            .from("org_invites")
            .select("*", { count: "exact", head: true })
            .eq("org_id", currentOrganization.id)
            .eq("role", "owner")
            .is("accepted_at", null);

          if ((memberCount || 0) + (inviteCount || 0) > 0) {
            throw new Error("This organization already has an owner.");
          }
        }

        // Create invitation
        const { error: inviteError } = await supabase
          .from("org_invites")
          .insert({
            org_id: currentOrganization.id,
            email: data.email,
            role: data.system_role as any,
            invited_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (inviteError) {
          if (inviteError.code === "23505")
            throw new Error("An invitation for this email already exists.");
          throw inviteError;
        }
      }

      const employeeData = {
        org_id: currentOrganization.id,
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role || null,
        department: data.department || null,
        hire_date: data.hire_date || null,
        notes: data.notes || null,
        custom_fields: Object.keys(fieldsObj).length > 0 ? fieldsObj : null,
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(employeeData);
        if (error) throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ["employees", currentOrganization.id],
      });

      if (data.system_role !== "none") {
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
        handleClose();
      }
    } catch (err) {
      console.error("Failed to save employee:", err);
      alert(err instanceof Error ? err.message : "Failed to save employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCustomFields([]);
    setCurrentStep(1);
    setShowSuccess(false);
    onOpenChange(false);
  };

  const handleNext = async () => {
    let fieldsToValidate: (keyof EmployeeFormData)[] = [];
    switch (currentStep) {
      case 1:
        fieldsToValidate = ["full_name", "email", "phone"];
        break;
      case 2:
        fieldsToValidate = ["role", "department", "hire_date"];
        break;
      case 3:
        fieldsToValidate = ["system_role"];
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
        {showSuccess ? (
          <div className="p-8 text-center space-y-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Invite Sent!</h2>
              <p className="text-sm text-slate-500">
                An invitation email has been sent to{" "}
                <strong>{lastInviteEmail}</strong>.
              </p>
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
            <DialogHeader className="p-5 pb-4 border-b shrink-0 text-left">
              <DialogTitle className="text-lg font-semibold text-slate-900">
                {initialData ? "Edit Employee" : "Add New Employee"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {initialData
                  ? "Update the employee's information."
                  : "Enter the employee's details across the following steps."}
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
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#3D5A3D]" />
                    Personal Information
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      {...register("full_name")}
                      placeholder="Sarah Johnson"
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Email
                      </label>
                      <Input
                        {...register("email")}
                        type="email"
                        placeholder="employee@company.com"
                        className={cn("h-9", errors.email && "border-red-500")}
                      />
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
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#3D5A3D]" />
                    Employment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Role / Position
                      </label>
                      <Input
                        {...register("role")}
                        placeholder="Operations Manager"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Department
                      </label>
                      <Input
                        {...register("department")}
                        placeholder="Operations"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Hire Date
                    </label>
                    <Input
                      {...register("hire_date")}
                      type="date"
                      className="h-9 w-full"
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#3D5A3D]" />
                    System Access & Invites
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Assign System Role
                      </label>
                      <select
                        {...register("system_role")}
                        className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20"
                      >
                        <option value="none">No System Access</option>
                        <option value="owner" disabled={hasOwner}>
                          Owner {hasOwner ? "(Already Assigned)" : ""}
                        </option>
                        <option value="admin">Administrator</option>
                        <option value="employee">Staff / Employee</option>
                        <option value="driver">Driver</option>
                      </select>
                      <p className="text-[11px] text-slate-500 leading-relaxed italic mt-2">
                        Choosing a role will trigger a system invitation to the
                        email provided in step 1. Invites can be accepted
                        immediately.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#3D5A3D]" />
                      Notes
                    </label>
                    <textarea
                      {...register("notes")}
                      placeholder="Internal notes about the employee..."
                      className="w-full min-h-[100px] rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Custom Fields
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomField}
                        className="h-8 gap-1"
                      >
                        <Plus size={14} />
                        Add Field
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {customFields.map((cf, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder="Label"
                            value={cf.key}
                            onChange={(e) =>
                              updateCustomField(index, "key", e.target.value)
                            }
                            className="h-9 flex-1"
                          />
                          <Input
                            placeholder="Value"
                            value={cf.value}
                            onChange={(e) =>
                              updateCustomField(index, "value", e.target.value)
                            }
                            className="h-9 flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomField(index)}
                            className="text-slate-400 hover:text-red-500 h-9 w-9 p-0"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                      {customFields.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4 italic">
                          No custom fields added yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="p-5 border-t bg-slate-50/50 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
                className={cn(currentStep === 1 && "invisible")}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    onClick={handleSubmit(onSubmit)}
                    className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : initialData ? (
                      "Save Changes"
                    ) : (
                      "Add Employee"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
