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

// Schema for driver form
const driverSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Invalid phone format (555) 555-5555")
    .optional()
    .or(z.literal("")),
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

export function DriverForm({
  open,
  onOpenChange,
  initialData,
}: DriverFormProps) {
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
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    values: initialData
      ? {
          full_name: initialData.full_name,
          email: initialData.email || "",
          phone: initialData.phone ? formatPhoneNumber(initialData.phone) : "",
          license_number: initialData.license_number || "",
          vehicle_info: initialData.vehicle_info || "",
          notes: initialData.notes || "",
        }
      : {
          full_name: "",
          email: "",
          phone: "",
          license_number: "",
          vehicle_info: "",
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
        email: data.email || null,
        phone: data.phone || null,
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {initialData ? "Edit Driver" : "Add New Driver"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the driver's information below."
              : "Enter the driver's information below. Custom fields can be added for organization-specific data."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4 p-6 pt-4"
          >
            {/* Required Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                {...register("full_name")}
                placeholder="Michael Chen"
                className={cn(errors.full_name && "border-red-500")}
              />
              {errors.full_name && (
                <p className="text-xs text-red-500">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* Contact Info Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <Input
                  {...register("email")}
                  type="email"
                  placeholder="driver@company.com"
                  className={cn(errors.email && "border-red-500")}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
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
                  <p className="text-xs text-red-500">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {/* License Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                License Number
              </label>
              <Input
                {...register("license_number")}
                placeholder="DL-123456789"
              />
            </div>

            {/* Vehicle Info */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Vehicle Information
              </label>
              <Input
                {...register("vehicle_info")}
                placeholder="2023 Toyota Sienna - White"
              />
              <p className="text-xs text-slate-500">
                Include vehicle type, make, model, year, or license plate
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Notes / Special Instructions
              </label>
              <textarea
                {...register("notes")}
                placeholder="Add any specific details about the driver..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              "Add Driver"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
