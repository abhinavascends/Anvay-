import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-blue-800 disabled:opacity-50",
  secondary:
    "bg-white border border-[var(--color-border)] text-foreground hover:bg-gray-50 disabled:opacity-50",
  ghost: "text-muted hover:bg-gray-100 disabled:opacity-50",
  danger:
    "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
);

Button.displayName = "Button";
