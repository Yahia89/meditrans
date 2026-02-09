import { useState, useMemo } from "react";
import { Check, CaretUpDown, MapPin } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { US_STATES } from "@/lib/constants";

interface StateSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function StateSelector({
  value,
  onValueChange,
  className,
  placeholder = "Select State",
}: StateSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const found = US_STATES.find((s) => s.value === value);
    return found?.label || value;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-11 justify-between rounded-xl bg-white border-slate-200 hover:bg-white transition-all font-normal",
            className,
          )}
        >
          <div className="flex items-center gap-2 text-left">
            <MapPin
              weight="duotone"
              className="w-4 h-4 text-red-500 shrink-0"
            />
            <span className={cn(!value && "text-slate-500")}>
              {selectedLabel || placeholder}
            </span>
          </div>
          <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0 rounded-2xl border-slate-200 shadow-lg"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search states..."
            className="h-10 border-none focus:ring-0"
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No state found.</CommandEmpty>
            <CommandGroup heading="US States">
              {US_STATES.map((state) => (
                <CommandItem
                  key={state.value}
                  value={state.label}
                  onSelect={() => {
                    onValueChange(state.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-lg py-2.5"
                >
                  <MapPin
                    weight="duotone"
                    className="mr-2 h-4 w-4 text-red-500"
                  />
                  <span className="font-medium text-slate-700">
                    {state.label}
                  </span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === state.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
