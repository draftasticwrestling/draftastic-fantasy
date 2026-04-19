"use client";

import Link from "next/link";
import { useState, useCallback, useLayoutEffect, useRef } from "react";
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
}: EventPageHeaderProps) {
  const hasPreview = !!(preview && String(preview).trim());
  const hasRecap = !!(recap && String(recap).trim());
  const showSection = hasPreview || hasRecap;
  const showBothPills = hasPreview && hasRecap;

  const [previewRecapView, setPreviewRecapView] = useState<"preview" | "recap">(() =>
    statusIsCompleted ? "recap" : "preview"
  );
  /** `innerWidth` is more reliable than `matchMedia` alone in some desktop setups; inline display avoids CSS fights. */
  const [viewportNarrow, setViewportNarrow] = useState(false);
  const [longFormOpen, setLongFormOpen] = useState(true);
  const prevNarrowRef = useRef<boolean | null>(null);
  const toggleLongForm = useCallback(() => {
    setLongFormOpen((o) => !o);
  }, []);

  useLayoutEffect(() => {
    const sync = () => {
      const narrow = typeof window !== "undefined" && window.innerWidth <= 639;
      setViewportNarrow(narrow);
      if (prevNarrowRef.current === null) {
        prevNarrowRef.current = narrow;
        setLongFormOpen(!narrow);
        return;
      }
      if (prevNarrowRef.current !== narrow) {
        prevNarrowRef.current = narrow;
        setLongFormOpen(!narrow);
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const pillBase = {
    padding: "8px 16px",
    borderRadius: 999,
    border: "2px solid #C6A04F",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer" as const,
  };

  return (
    <div className="event-page-header">
      <nav className="event-page-header__crumbs" aria-label="Event results navigation">
        <Link href="/event-results" className="event-page-header__crumbLink">
          ← Event Results
        </Link>
      </nav>

      <div className="event-page-header__brandCol">
        <EventLogoOrText
          name={eventName}
          eventId={eventId}
          className="event-page-header__logo"
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            height: "auto",
            width: "auto",
            objectFit: "contain",
          }}
          textStyle={{ fontSize: 18 }}
        />
        <div className="event-page-header__nameRow">
          <span className="event-page-header__eventName">{eventName}</span>
          {isLive ? <span className="event-page-header__liveBadge">LIVE</span> : null}
        </div>
        <h1 className="event-page-header__title">{h1Text}</h1>
        <p className="event-page-header__metaLine">{metaLine}</p>
        <nav className="event-page-header__jump" aria-label="Results by show">
          <Link href="/event-results?show=raw" className="event-page-header__jumpLink">
            Raw results
          </Link>
          <Link href="/event-results?show=smackdown" className="event-page-header__jumpLink">
            SmackDown results
          </Link>
          <Link href="/event-results?show=ple" className="event-page-header__jumpLink">
            PLE results
          </Link>
        </nav>
        <div className="event-page-header__when">
          <span>
            <strong>{formattedDateLong}</strong>
            {location ? ` — ${location}` : ""}
          </span>
          {broadcastFormatted ? (
            <span className="event-page-header__broadcast">
              Event Time: <span className="event-page-header__broadcastTime">{broadcastFormatted}</span>
            </span>
          ) : null}
        </div>
      </div>

      {showSection && (
        <div className="event-page-header__longform-wrap" style={{ marginTop: 16, marginBottom: 16 }}>
          <button
            type="button"
            className="event-page-header__longform-toggle"
            style={{ display: viewportNarrow ? "flex" : "none" }}
            aria-expanded={longFormOpen}
            onClick={toggleLongForm}
          >
            {longFormOpen
              ? "Hide preview & recap"
              : showBothPills
                ? "Show event preview & recap"
                : hasPreview
                  ? "Show event preview"
                  : "Show event recap"}
          </button>
          <div
            className={`event-page-header__longform${longFormOpen ? " event-page-header__longform--open" : ""}`}
            style={
              viewportNarrow && !longFormOpen
                ? { display: "none" }
                : { display: "block", marginTop: viewportNarrow && longFormOpen ? 10 : 0 }
            }
          >
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
        </div>
      )}
    </div>
  );
}
