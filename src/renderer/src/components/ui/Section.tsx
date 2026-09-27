interface SectionProps {
  title: string;
  children: React.ReactNode;
  hint?: string;
}

export function Section({ title, children, hint }: SectionProps) {
  return (
    <section className="px-5 py-4 border-b border-[var(--border)] last:border-b-0">
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-amber font-medium">
          {title}
        </h3>
        {hint && (
          <span className="font-mono text-[10px] text-paper-muted">{hint}</span>
        )}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
