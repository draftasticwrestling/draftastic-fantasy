"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

export type RouterTo = string | { pathname: string; state?: unknown };

function toHref(to: RouterTo): string {
  if (typeof to === "string") return to || "/";
  return to?.pathname || "/";
}

export function Link({
  to,
  children,
  style,
  className,
  onClick,
  ...rest
}: {
  to: RouterTo;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
} & Record<string, unknown>) {
  const href = toHref(to);
  const { replace: _r, state: _s, ...linkRest } = rest;
  return (
    <NextLink href={href} style={style} className={className} onClick={onClick} {...linkRest}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();
  return (path: string) => {
    router.push(path);
  };
}
