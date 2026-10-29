import { cn } from "@/shared/lib/utils"

/** Placeholder with a shimmer sweep (static under prefers-reduced-motion). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
