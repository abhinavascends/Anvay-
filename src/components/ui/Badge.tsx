const severityStyles: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  EXTREME: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  SEVERE: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  MODERATE: "bg-amber-100 text-amber-700",
  LOW: "bg-green-100 text-green-700",
  MINOR: "bg-green-100 text-green-700",
  AVAILABLE: "bg-green-100 text-green-700",
  OPEN: "bg-green-100 text-green-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  EN_ROUTE: "bg-blue-100 text-blue-700",
  ON_SCENE: "bg-purple-100 text-purple-700",
  RESOLVED: "bg-gray-100 text-gray-600",
  COMPLETED: "bg-gray-100 text-gray-600",
  UNAVAILABLE: "bg-gray-200 text-gray-500",
  FILLING: "bg-amber-100 text-amber-700",
  NEAR_CAPACITY: "bg-orange-100 text-orange-700",
  FULL: "bg-red-100 text-red-700",
};

export function Badge({
  label,
  color,
}: {
  label: string;
  color?: string;
}) {
  const style =
    (color && severityStyles[color]) ||
    "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}
