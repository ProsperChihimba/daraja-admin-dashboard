import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-pill bg-brand text-white shadow-[0_4px_12px_rgba(51,153,60,0.18)] hover:bg-brand-hover",
        outline:
          "rounded-pill bg-surface text-text border border-border-soft hover:border-text-muted/40 hover:bg-page-cream",
        secondary:
          "rounded-pill bg-page-cream text-text hover:bg-brand-soft",
        ghost: "rounded-md text-text hover:bg-page-cream",
        soft: "rounded-pill bg-brand-soft text-brand hover:bg-brand-soft/80",
        destructive:
          "rounded-pill bg-danger-bg text-danger-fg hover:opacity-90",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-5 text-sm",
        sm: "h-8 gap-1.5 px-4 text-[13px]",
        xs: "h-7 gap-1 px-3 text-xs",
        lg: "h-11 gap-2 px-6 text-[15px]",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
        "icon-xs": "size-7 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
