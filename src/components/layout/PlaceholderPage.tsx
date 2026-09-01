export default function PlaceholderPage({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
        <p className="text-lg font-medium">Coming in {phase}</p>
        <p className="mt-1 text-sm text-muted">
          This module is scaffolded and ready for implementation.
        </p>
      </div>
    </div>
  );
}
