"use client"

import * as React from "react"
import { Switch as AnimalSwitch } from "animal-island-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  checked,
  defaultChecked,
  disabled,
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange" | "defaultChecked"> & {
  size?: "sm" | "default"
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <AnimalSwitch
      data-slot="switch"
      size={size === "sm" ? "small" : "default"}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onChange={onCheckedChange}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
}

export { Switch }
