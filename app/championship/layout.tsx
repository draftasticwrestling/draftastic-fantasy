import type { ReactNode } from "react";

export default function ChampionshipLayout({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 960,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {children}
    </main>
  );
}
