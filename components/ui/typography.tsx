import { cn } from "@/lib/utils";
import * as React from "react";

type Heading = React.HTMLAttributes<HTMLHeadingElement>;
type Para = React.HTMLAttributes<HTMLParagraphElement>;
type Span = React.HTMLAttributes<HTMLSpanElement>;

export const TextH1 = ({ className, ...props }: Heading) => (
  <h1
    className={cn(
      "text-4xl font-bold tracking-tight text-text lg:text-5xl",
      className,
    )}
    {...props}
  />
);

export const TextH2 = ({ className, ...props }: Heading) => (
  <h2
    className={cn(
      "text-3xl font-semibold tracking-tight text-text",
      className,
    )}
    {...props}
  />
);

export const TextH3 = ({ className, ...props }: Heading) => (
  <h3
    className={cn(
      "text-[26px] font-semibold tracking-tight text-text",
      className,
    )}
    {...props}
  />
);

export const TextH4 = ({ className, ...props }: Heading) => (
  <h4
    className={cn("text-xl font-semibold tracking-tight text-text", className)}
    {...props}
  />
);

export const TextH5 = ({ className, ...props }: Heading) => (
  <h5
    className={cn("text-base font-semibold text-text", className)}
    {...props}
  />
);

export const TextP = ({ className, ...props }: Para) => (
  <p className={cn("text-sm leading-6 text-text", className)} {...props} />
);

export const TextMuted = ({ className, ...props }: Para) => (
  <p className={cn("text-sm text-text-muted", className)} {...props} />
);

export const TextSubtle = ({ className, ...props }: Para) => (
  <p className={cn("text-xs text-text-faint", className)} {...props} />
);

export const TextEyebrow = ({ className, ...props }: Span) => (
  <span
    className={cn(
      "text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted",
      className,
    )}
    {...props}
  />
);

export const TextLabel = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("text-sm font-medium text-text", className)}
    {...props}
  />
);
