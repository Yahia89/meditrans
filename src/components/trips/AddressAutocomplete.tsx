import React, {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Input } from "@/components/ui/input";

// Note: We are using the native Google Maps JS API loaded in the parent context.

interface AddressAutocompleteProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange"
> {
  onAddressSelect: (place: google.maps.places.PlaceResult) => void;
  onChange?: (value: string) => void;
  isLoaded: boolean;
  value?: string;
}

export const AddressAutocomplete = forwardRef<
  HTMLInputElement,
  AddressAutocompleteProps
>(({ onAddressSelect, onChange, isLoaded, value, ...props }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const isSelectingRef = useRef(false);

  // Merge refs so that React Hook Form can access the input while we also use it for Google Maps
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Memoize the callback to avoid recreating the listener
  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (place && place.formatted_address) {
      isSelectingRef.current = true;
      // Update the input value directly
      if (inputRef.current) {
        inputRef.current.value = place.formatted_address;
      }
      // Notify parent of the selection
      onAddressSelect(place);
      // Reset the flag after a short delay
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 100);
    }
  }, [onAddressSelect]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Prevent reinitializing if already set up
    if (autocompleteRef.current) return;

    const options: google.maps.places.AutocompleteOptions = {
      fields: ["formatted_address", "geometry", "name", "place_id"],
      types: ["address"], // Restrict to addresses
      componentRestrictions: { country: "us" }, // Restrict to US addresses
    };

    autocompleteRef.current = new google.maps.places.Autocomplete(
      inputRef.current,
      options,
    );

    autocompleteRef.current.addListener("place_changed", handlePlaceChanged);

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, handlePlaceChanged]);

  // Sync external value changes to the input
  useEffect(() => {
    if (inputRef.current && value !== undefined && !isSelectingRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only propagate manual typing, not autocomplete selection
    if (!isSelectingRef.current && onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <Input
      ref={inputRef}
      {...props}
      onChange={handleInputChange}
      autoComplete="off"
    />
  );
});

AddressAutocomplete.displayName = "AddressAutocomplete";
