import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

/**
 * GET /api/score-event?eventId=xxx
 * Loads the event from Supabase, runs the fantasy points calculator for each
 * match and each participant, returns points per wrestler per match.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      const { data: events } = await supabase
        .from("events")
        .select("id, name, date")
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(20);
      return NextResponse.json({
        hint: "Add ?eventId=xxx to the URL to score that event. Example: /api/score-event?eventId=raw-2025-06-09",
        events: events ?? [],
      });
    }

    const { data: event, error } = await supabase
      .from("events")
      .select("id, name, date, location, matches")
      .eq("id", eventId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, eventId },
        { status: 500 }
      );
    }

    if (!event) {
      return NextResponse.json(
        { error: "Event not found", eventId },
        { status: 404 }
      );
    }

    const { scoreEvent } = await import("@/lib/scoring/scoreEvent.js");
    const scored = scoreEvent(event);
    return NextResponse.json(scored);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[score-event]", err);
    return NextResponse.json(
      { error: "Scoring failed", details: message },
      { status: 500 }
    );
  }
}
