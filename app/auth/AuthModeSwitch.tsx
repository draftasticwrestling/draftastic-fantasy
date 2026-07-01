import Link from "next/link";
import { PLAY_PATH } from "@/lib/playFunnel";

type Props = {
  mode: "sign-in" | "sign-up";
  next?: string;
};

export function AuthModeSwitch({ mode, next }: Props) {
  const resolvedNext = next?.trim() || (mode === "sign-up" ? PLAY_PATH : "/");
  const otherMode = mode === "sign-in" ? "sign-up" : "sign-in";
  const otherHref = `/auth/${otherMode}?next=${encodeURIComponent(resolvedNext)}`;

  if (mode === "sign-in") {
    return (
      <p style={{ marginTop: 20, fontSize: 15, color: "#555" }}>
        Don&apos;t have an account?{" "}
        <Link href={otherHref} style={{ color: "#1a73e8" }}>
          Create an account
        </Link>
      </p>
    );
  }

  return (
    <p style={{ marginTop: 20, fontSize: 15, color: "#555" }}>
      Already have an account?{" "}
      <Link href={otherHref} style={{ color: "#1a73e8" }}>
        Sign in
      </Link>
    </p>
  );
}
