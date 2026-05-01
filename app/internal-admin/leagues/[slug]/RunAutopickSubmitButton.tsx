"use client";

import { useFormStatus } from "react-dom";

export function RunAutopickSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="admin-article-submit"
      style={{ width: "fit-content" }}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Starting autopick..." : "Run autopick now"}
    </button>
  );
}
