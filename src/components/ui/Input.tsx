import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from "react";

const base =
  "w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-white text-sm placeholder:text-gray-400 focus:outline-2 focus:outline-offset-0 focus:outline-[var(--color-accent)] disabled:bg-gray-50";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input ref={ref} className={`${base} ${className}`} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", ...props }, ref) => (
  <select ref={ref} className={`${base} ${className}`} {...props} />
));
Select.displayName = "Select";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-foreground"
    >
      {children}
    </label>
  );
}
