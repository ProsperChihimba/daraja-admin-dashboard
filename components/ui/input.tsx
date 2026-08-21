import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-input border border-border-soft bg-surface px-3.5 text-sm text-text transition-colors outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:bg-page-cream disabled:opacity-60 aria-invalid:border-danger-fg aria-invalid:ring-2 aria-invalid:ring-danger-bg/40 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
