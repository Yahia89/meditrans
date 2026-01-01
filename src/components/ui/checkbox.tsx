import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Aggressively reset all global button styles
        "peer shrink-0 bg-white transition-all duration-150",
        // Force dimensions and shape with !important to override global button styles
        "!h-[18px] !w-[18px] !min-h-[18px] !min-w-[18px] !p-0 !rounded-[4px] !border-2",
        // High visibility border
        "!border-slate-400 hover:!border-slate-500",
        // Flex centering for the icon
        "flex items-center justify-center",
        // Focus styles
        "focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-[#3D5A3D] focus-visible:!ring-offset-2",
        // Disabled styles
        "disabled:!cursor-not-allowed disabled:!opacity-50",
        // Checked state styles
        "data-[state=checked]:!bg-[#3D5A3D] data-[state=checked]:!border-[#3D5A3D] data-[state=checked]:!text-white",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current pointer-events-none"
      >
        <CheckIcon className="!h-[14px] !w-[14px]" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
