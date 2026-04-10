"use client";

import Link from "next/link";
import { useState } from "react";
import { EventLogoOrText } from "./EventLogoOrText";

const gold = "#C6A04F";

export type EventPageHeaderProps = {
  eventName: string;
  eventId?: string | null;
  h1Text: string;
  metaLine: string;
  formattedDateLong: string;
  location: string | null;
  broadcastFormatted: string | null;
  preview: string | null;
  recap: string | null;
  statusIsCompleted: boolean;
  isLive: boolean;
  /** Same event on prowrestlingboxscore.com (see buildProWrestlingBoxscoreEventUrl). */
  boxscoreHref: string;
};

export function EventPageHeader({
  eventName,
  eventId,
  h1Text,
  metaLine,
  formattedDateLong,
  location,
  broadcastFormatted,
  preview,
  recap,
  statusIsCompleted,
  isLive,
  boxscoreHref,
}: EventPageHeaderProps) {
  const hasPreview = !!(preview && String(preview).trim());
  const hasRecap = !!(recap && String(recap).trim());
  const showSection = hasPreview || hasRecap;
  const showBothPills = hasPreview && hasRecap;

  const [previewRecapView, setPreviewRecapView] = useState<"preview" | "recap">(() =>
    statusIsCompleted ? "recap" : "preview"
  );

  const pillBase = {
    padding: "8px 16px",
    borderRadius: 999,
    border: "2px solid #C6A04F",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer" as const,
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/event-results" style={{ color: gold }}>
          ← Event Results
        </Link>
        {" · "}
        <Link href="/" style={{ color: gold }}>
          Home
        </Link>
        {" · "}
        <a href={boxscoreHref} target="_blank" rel="noopener noreferrer" style={{ color: gold }}>
          Boxscore
        </a>
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <EventLogoOrText
          name={eventName}
          eventId={eventId}
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            maxHeight: 48,
            maxWidth: 96,
            height: "auto",
            width: "auto",
            objectFit: "contain",
          }}
          textStyle={{ fontSize: 18 }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 20 }}>{eventName}</span>
          {isLive ? (
            <span
              style={{
                background: "#27ae60",
                color: "white",
                fontWeight: 700,
                borderRadius: 4,
                padding: "2px 10px",
                fontSize: 14,
              }}
            >
              LIVE
            </span>
          ) : null}
        </div>
        <h1
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: 800,
            marginTop: 8,
            marginBottom: 4,
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {h1Text}
        </h1>
        <p
          style={{
            color: "#ccc",
            fontSize: 14,
            maxWidth: 700,
            textAlign: "center",
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          {metaLine}
        </p>
        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "8px 16px",
            fontSize: 14,
          }}
        >
          <Link href="/event-results?show=raw" style={{ color: gold, textDecoration: "none", fontWeight: 600 }}>
            Raw results
          </Link>
          <Link href="/event-results?show=smackdown" style={{ color: gold, textDecoration: "none", fontWeight: 600 }}>
            SmackDown results
          </Link>
          <Link href="/event-results?show=ple" style={{ color: gold, textDecoration: "none", fontWeight: 600 }}>
            PLE results
          </Link>
          <Link href="/wrestlers" style={{ color: gold, textDecoration: "none", fontWeight: 600 }}>
            Roster
          </Link>
          <a
            href="https://prowrestlingboxscore.com/championships"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: gold, textDecoration: "none", fontWeight: 600 }}
          >
            Championships
          </a>
        </p>
        <div
          style={{
            color: gold,
            marginTop: 8,
            fontSize: 18,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span>
            <strong>{formattedDateLong}</strong>
            {location ? ` — ${location}` : ""}
          </span>
          {broadcastFormatted ? (
            <span style={{ fontSize: 14, color: "#ddd", fontWeight: 600 }}>
              Event Time: <span style={{ color: gold, fontWeight: 700 }}>{broadcastFormatted}</span>
            </span>
          ) : null}
        </div>
      </div>

      {showSection && (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          {showBothPills && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewRecapView("preview")}
                style={{
                  ...pillBase,
                  background: previewRecapView === "preview" ? gold : "transparent",
                  color: previewRecapView === "preview" ? "#232323" : gold,
                }}
              >
                Event Preview
              </button>
              <button
                type="button"
                onClick={() => setPreviewRecapView("recap")}
                style={{
                  ...pillBase,
                  background: previewRecapView === "recap" ? gold : "transparent",
                  color: previewRecapView === "recap" ? "#232323" : gold,
                }}
              >
                Event Recap
              </button>
            </div>
          )}
          {(previewRecapView === "preview" || !hasRecap) && hasPreview && (
            <div
              style={{
                padding: 16,
                background: "#232323",
                borderRadius: 8,
                border: "1px solid rgba(198, 160, 79, 0.27)",
              }}
            >
              <div style={{ color: gold, fontWeight: 700, marginBottom: 8 }}>Event Preview</div>
              <div style={{ color: "#fff", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{preview}</div>
            </div>
          )}
          {(previewRecapView === "recap" || !hasPreview) && hasRecap && (
            <div
              style={{
                padding: 16,
                background: "#1c1c1c",
                borderRadius: 8,
                border: "1px solid rgba(198, 160, 79, 0.4)",
              }}
            >
              <div style={{ color: gold, fontWeight: 700, marginBottom: 8 }}>Event Recap</div>
              <div style={{ color: "#fff", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{recap}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
