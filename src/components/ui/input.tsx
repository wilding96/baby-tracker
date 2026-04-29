import * as React from "react"
import { Input as AnimalInput } from "animal-island-ui"
import type { InputProps as AnimalInputProps } from "animal-island-ui"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  size,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> &
  Pick<AnimalInputProps, "size">) {
  return (
    <AnimalInput
      type={type}
      size={size}
      data-slot="input"
      className={cn(
        "w-full min-w-0 text-base md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
