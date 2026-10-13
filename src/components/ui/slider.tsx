import type * as React from "react";

import { cn } from "@/lib/utils";

function Slider({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="range"
      data-slot="slider"
      className={cn(
        "accent-primary m-0 h-5 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Slider };
