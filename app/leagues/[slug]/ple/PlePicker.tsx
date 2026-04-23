"use client";

import { useRouter } from "next/navigation";

type PlePickerOption = {
  href: string;
  label: string;
};

type Props = {
  valueHref: string;
  options: PlePickerOption[];
  label?: string;
};

export function PlePicker({ valueHref, options, label = "PLE" }: Props) {
  const router = useRouter();

  if (options.length <= 1) return null;

  return (
    <div className="ple-mobile-picker" style={{ marginBottom: 12 }}>
      <label
        htmlFor="ple-picker"
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <select
        id="ple-picker"
        value={valueHref}
        onChange={(e) => {
          const href = e.target.value;
          if (!href || href === valueHref) return;
          router.push(href);
        }}
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 10,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-input)",
          color: "var(--color-text)",
          padding: "10px 12px",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {options.map((opt) => (
          <option key={opt.href} value={opt.href}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
