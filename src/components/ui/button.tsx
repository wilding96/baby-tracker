import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Button as AnimalButton } from "animal-island-ui"
import type { ButtonProps as AnimalButtonProps } from "animal-island-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type: htmlType = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const animalType: AnimalButtonProps["type"] =
    variant === "link"
      ? "link"
      : variant === "ghost"
        ? "text"
        : variant === "outline" || variant === "secondary"
          ? "default"
          : variant === "destructive"
            ? "primary"
            : "primary"
  const animalSize: AnimalButtonProps["size"] =
    size === "lg" ? "large" : size === "sm" || size === "xs" ? "small" : "middle"

  if (!asChild) {
    return (
      <AnimalButton
        data-slot="button"
        data-variant={variant}
        data-size={size}
        type={animalType}
        size={animalSize}
        htmlType={htmlType}
        danger={variant === "destructive"}
        className={className}
        {...props}
      />
    )
  }

  const Comp = Slot
  const linkButtonClass = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 font-bold transition-all",
    "border-[#aaa69d] bg-[#f8f8f0] text-[#794f27] shadow-[0_5px_#bdaea0]",
    "hover:-translate-y-0.5 hover:border-[#19c8b9] hover:text-[#19c8b9]",
    "active:translate-y-0.5 active:shadow-[0_1px_#bdaea0]",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "lg" ? "h-12 px-8 text-base" : size === "sm" || size === "xs" ? "h-8 px-4 text-xs" : "h-10 px-5 text-sm",
    variant === "ghost" && "border-transparent bg-transparent shadow-none",
    variant === "link" && "border-transparent bg-transparent text-[#19c8b9] shadow-none",
    variant === "destructive" && "border-[#e05a5a] bg-[#e05a5a] text-white shadow-[0_5px_#c94444]",
    className,
  )

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={linkButtonClass}
      {...props}
    />
  )
}

export { Button, buttonVariants }
