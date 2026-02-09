"use client";

import { useState, useMemo } from "react";
import {
  Check,
  CaretUpDown,
  Globe,
  Monitor,
  Buildings,
} from "@phosphor-icons/react";
import { US_TIMEZONES } from "@/lib/timezone";
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

interface TimezoneSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function TimezoneSelector({
  value,
  onValueChange,
  className,
  placeholder = "Select Timezone",
}: TimezoneSelectorProps) {
  const [open, setOpen] = useState(false);

  const browserTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

  const selectedLabel = useMemo(() => {
    if (value === "") return "Organization Default";
    if (!value) return null;

    // Check browser timezone first
    if (browserTimezone && value === browserTimezone) {
      return `My Device (${browserTimezone})`;
    }

    // Check US timezones
    const found = US_TIMEZONES.find((tz) => tz.value === value);
    return found?.label || value;
  }, [value, browserTimezone]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-11 justify-between rounded-xl bg-slate-50/50 border-slate-200 hover:bg-white transition-all font-normal",
            className,
          )}
        >
          <div className="flex items-center gap-2 text-left">
            <Globe
              weight="duotone"
              className="w-4 h-4 text-[#3D5A3D] shrink-0"
            />
            <span
              className={cn(
                "truncate",
                value === undefined && "text-slate-500",
              )}
            >
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
            placeholder="Search timezones..."
            className="h-10 border-none focus:ring-0"
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No timezone found.</CommandEmpty>

            {/* Default Group */}
            <CommandGroup heading="Preferences">
              <CommandItem
                value="org-default"
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
                className="cursor-pointer rounded-lg py-2.5"
              >
                <Buildings
                  weight="duotone"
                  className="mr-2 h-4 w-4 text-blue-500"
                />
                <span className="font-medium text-slate-700">
                  Use Organization Default
                </span>
                <Check
                  className={cn(
                    "ml-auto h-4 w-4",
                    value === "" ? "opacity-100" : "opacity-0",
                  )}
                />
              </CommandItem>
            </CommandGroup>

            {/* Local Timezone Group */}
            {browserTimezone && (
              <CommandGroup heading="Local Timezone">
                <CommandItem
                  value={browserTimezone}
                  onSelect={() => {
                    onValueChange(browserTimezone);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-lg py-2.5"
                >
                  <Monitor
                    weight="duotone"
                    className="mr-2 h-4 w-4 text-emerald-500"
                  />
                  <span className="font-medium text-slate-700">
                    My Device ({browserTimezone})
                  </span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === browserTimezone ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              </CommandGroup>
            )}

            {/* US Timezones Group */}
            <CommandGroup heading="US Timezones">
              {US_TIMEZONES.map((tz) => (
                <CommandItem
                  key={tz.value}
                  value={tz.value}
                  onSelect={() => {
                    onValueChange(tz.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-lg py-2.5"
                >
                  <span className="font-medium text-slate-600">{tz.label}</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === tz.value ? "opacity-100" : "opacity-0",
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
