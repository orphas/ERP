import { ReactNode } from "react";

type UniversalFormSectionProps = {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

type UniversalFieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

type UniversalActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function UniversalFormSection({ title, description, className = "", children }: UniversalFormSectionProps) {
  return (
    <section className={`card space-y-4 ${className}`.trim()}>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-slate-400 mt-1">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function UniversalFormGrid({ children, className = "grid gap-3 md:grid-cols-3" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function UniversalField({ label, hint, children, className = "form-group" }: UniversalFieldProps) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint ? <p className="text-xs text-slate-400 mt-1">{hint}</p> : null}
    </div>
  );
}

export function UniversalActionBar({ children, className = "flex flex-wrap gap-3" }: UniversalActionBarProps) {
  return <div className={className}>{children}</div>;
}
