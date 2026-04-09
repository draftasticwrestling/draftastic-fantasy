"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useFantasyHomeHref } from "@/lib/hooks/useFantasyHomeHref";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Hub Quick links: same destination as the main nav "Fantasy" pill. */
export function FantasyHomeLink({ children, className }: Props) {
  const href = useFantasyHomeHref();
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
