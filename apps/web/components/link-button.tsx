import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"
import Link from "next/link"

type LinkButtonProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>

/**
 * A link styled as a button. Base UI's Button expects a native <button>, so
 * navigation links use the button *variants* directly instead.
 */
export function LinkButton({ className, variant, size, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
