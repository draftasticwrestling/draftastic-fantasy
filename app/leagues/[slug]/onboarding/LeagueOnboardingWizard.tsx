"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { ManagerAvatarPresetPicker } from "@/app/components/ManagerAvatarPresetPicker";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import { isAllowedManagerPresetUrl } from "@/lib/managerAvatarPresets";
import { FACTION_NAME_MAX_LENGTH, validateFactionNameForSave } from "@/lib/factionName";
import {
  MANAGER_CATCHPHRASE_MAX_LENGTH,
  validateManagerCatchphraseForSave,
} from "@/lib/managerCatchphrase";
import { updateFactionInfoAction, updateLeagueCatchphraseAction, updateLeagueManagerAvatarAction } from "../team/actions";
import { checkOnboardingDraftPrefsAction, completeLeagueOnboardingAction } from "./actions";

type Step = "faction" | "avatar" | "catchphrase" | "confirm" | "draft";

const STEPS: Step[] = ["faction", "avatar", "catchphrase", "confirm", "draft"];

type Props = {
  leagueSlug: string;
  leagueName: string;
  isSalaryCap: boolean;
  draftType: string;
  includeNxt: boolean;
  initialTeamName: string;
  initialCatchphrase: string;
  initialLeagueAvatarUrl: string | null;
  profileAvatarUrl: string | null;
  displayName: string;
  initialError: string | null;
};

export function LeagueOnboardingWizard({
  leagueSlug,
  leagueName,
  isSalaryCap,
  draftType,
  includeNxt,
  initialTeamName,
  initialCatchphrase,
  initialLeagueAvatarUrl,
  profileAvatarUrl,
  displayName,
  initialError,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("faction");
  const [teamName, setTeamName] = useState(initialTeamName);
  const [catchphrase, setCatchphrase] = useState(initialCatchphrase);
  const [leagueAvatarUrl, setLeagueAvatarUrl] = useState<string | null>(initialLeagueAvatarUrl);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    initialError ? { type: "err", text: initialError } : null
  );
  const [pending, startTransition] = useTransition();

  const stepIndex = STEPS.indexOf(step);
  const progress = step === "draft" ? 100 : Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const previewUrl = resolvedManagerAvatarUrl({
    manager_avatar_url: leagueAvatarUrl,
    avatar_url: profileAvatarUrl,
  });
  const initial = (displayName.trim().charAt(0) || "?").toUpperCase();
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const pickerSelected =
    leagueAvatarUrl?.trim() && isAllowedManagerPresetUrl(leagueAvatarUrl.trim(), supabaseOrigin)
      ? leagueAvatarUrl.trim()
      : null;

  const saveAvatar = useCallback(
    async (url: string | null) => {
      const result = await updateLeagueManagerAvatarAction(leagueSlug, url);
      if (result.error) {
        setMessage({ type: "err", text: result.error });
        return false;
      }
      setLeagueAvatarUrl(url);
      return true;
    },
    [leagueSlug]
  );

  function goNext() {
    setMessage(null);
    if (step === "faction") setStep("avatar");
    else if (step === "avatar") setStep("catchphrase");
    else if (step === "catchphrase") setStep("confirm");
    else if (step === "confirm" && !isSalaryCap) setStep("draft");
  }

  function goBack() {
    setMessage(null);
    if (step === "avatar") setStep("faction");
    else if (step === "catchphrase") setStep("avatar");
    else if (step === "confirm") setStep("catchphrase");
    else if (step === "draft") setStep("confirm");
  }

  function handleFactionNext() {
    const checked = validateFactionNameForSave(teamName.trim() || null);
    if (!checked.ok) {
      setMessage({ type: "err", text: checked.error });
      return;
    }
    startTransition(async () => {
      const result = await updateFactionInfoAction(leagueSlug, checked.value);
      if (result.error) setMessage({ type: "err", text: result.error });
      else goNext();
    });
  }

  async function handleAvatarNext() {
    goNext();
  }

  function handleCatchphraseNext(skip = false) {
    if (skip) {
      goNext();
      return;
    }
    const checked = validateManagerCatchphraseForSave(catchphrase.trim() || null);
    if (!checked.ok) {
      setMessage({ type: "err", text: checked.error });
      return;
    }
    startTransition(async () => {
      const result = await updateLeagueCatchphraseAction(leagueSlug, checked.value);
      if (result.error) setMessage({ type: "err", text: result.error });
      else goNext();
    });
  }

  function finishSalaryCap() {
    setMessage(null);
    router.push(`/leagues/${leagueSlug}/salary-cap`);
  }

  function verifyPrefsAndFinish() {
    startTransition(async () => {
      const check = await checkOnboardingDraftPrefsAction(leagueSlug);
      if (!check.ok) {
        setMessage({ type: "err", text: check.error ?? "Save your draft preferences first." });
        return;
      }
      const result = await completeLeagueOnboardingAction(leagueSlug);
      if (result.error) {
        setMessage({ type: "err", text: result.error });
        return;
      }
      router.push(result.redirectTo ?? `/leagues/${leagueSlug}`);
      router.refresh();
    });
  }

  return (
    <div className="league-onboarding-card">
      <div className="league-onboarding-progress" aria-hidden>
        <div className="league-onboarding-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <p className="league-onboarding-eyebrow">Welcome to {leagueName}</p>
      <h1 className="league-onboarding-title">Set up your faction for this league</h1>
      <p className="league-onboarding-sub">
        These choices apply only in <strong>{leagueName}</strong> — not your other leagues.
      </p>

      {message ? (
        <p className={`league-onboarding-message league-onboarding-message--${message.type}`} role="alert">
          {message.text}
        </p>
      ) : null}

      {step === "faction" ? (
        <section className="league-onboarding-step">
          <h2>Faction name</h2>
          <p>How should your faction appear in standings and matchups?</p>
          <label className="league-onboarding-label" htmlFor="onboard-team-name">
            Faction name <span>(max {FACTION_NAME_MAX_LENGTH} characters)</span>
          </label>
          <input
            id="onboard-team-name"
            className="league-onboarding-input"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder={displayName}
            maxLength={FACTION_NAME_MAX_LENGTH + 5}
            autoFocus
          />
          <div className="league-onboarding-actions">
            <button type="button" className="app-button" disabled={pending} onClick={handleFactionNext}>
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </section>
      ) : null}

      {step === "avatar" ? (
        <section className="league-onboarding-step">
          <h2>Manager avatar</h2>
          <p>Pick a look for this league. You can use your account photo or choose a preset.</p>
          <div className="league-onboarding-avatar-preview">
            {previewUrl ? (
              <Image src={previewUrl} alt="" width={72} height={72} className="league-onboarding-avatar-img" />
            ) : (
              <span className="league-onboarding-avatar-fallback">{initial}</span>
            )}
          </div>
          <ManagerAvatarPresetPicker
            selectedUrl={pickerSelected}
            disabled={pending}
            onSelect={(selection) => {
              startTransition(async () => {
                await saveAvatar(selection.url);
              });
            }}
          />
          <button
            type="button"
            className="app-button app-button--secondary"
            style={{ marginTop: 12 }}
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await saveAvatar(null);
              });
            }}
          >
            Use my account photo
          </button>
          <div className="league-onboarding-actions">
            <button type="button" className="app-button app-button--secondary" onClick={goBack}>
              Back
            </button>
            <button type="button" className="app-button" disabled={pending} onClick={handleAvatarNext}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === "catchphrase" ? (
        <section className="league-onboarding-step">
          <h2>Catchphrase</h2>
          <p>Optional tagline shown on standings — like a nickname for your faction.</p>
          <label className="league-onboarding-label" htmlFor="onboard-catchphrase">
            Catchphrase <span>(optional, max {MANAGER_CATCHPHRASE_MAX_LENGTH})</span>
          </label>
          <input
            id="onboard-catchphrase"
            className="league-onboarding-input"
            value={catchphrase}
            onChange={(e) => setCatchphrase(e.target.value)}
            placeholder="e.g. Acknowledge me"
            maxLength={MANAGER_CATCHPHRASE_MAX_LENGTH + 5}
          />
          <div className="league-onboarding-actions">
            <button type="button" className="app-button app-button--secondary" onClick={goBack}>
              Back
            </button>
            <button
              type="button"
              className="app-button app-button--secondary"
              disabled={pending}
              onClick={() => handleCatchphraseNext(true)}
            >
              Skip
            </button>
            <button type="button" className="app-button" disabled={pending} onClick={() => handleCatchphraseNext(false)}>
              {pending ? "Saving…" : "Continue"}
            </button>
          </div>
        </section>
      ) : null}

      {step === "confirm" ? (
        <section className="league-onboarding-step">
          <h2>Confirm your faction</h2>
          <div className="league-onboarding-summary">
            <div className="league-onboarding-summary__row">
              {previewUrl ? (
                <Image src={previewUrl} alt="" width={56} height={56} className="league-onboarding-avatar-img" />
              ) : (
                <span className="league-onboarding-avatar-fallback league-onboarding-avatar-fallback--sm">
                  {initial}
                </span>
              )}
              <div>
                <div className="league-onboarding-summary__name">{teamName.trim() || displayName}</div>
                {catchphrase.trim() ? (
                  <div className="league-onboarding-summary__catch">“{catchphrase.trim()}”</div>
                ) : (
                  <div className="league-onboarding-summary__muted">No catchphrase</div>
                )}
              </div>
            </div>
          </div>
          <div className="league-onboarding-actions">
            <button type="button" className="app-button app-button--secondary" onClick={goBack}>
              Back
            </button>
            <button
              type="button"
              className="app-button"
              disabled={pending}
              onClick={isSalaryCap ? finishSalaryCap : goNext}
            >
              {isSalaryCap
                ? pending
                  ? "Continuing…"
                  : "Build my salary cap roster →"
                : "Continue to draft preferences"}
            </button>
          </div>
        </section>
      ) : null}

      {step === "draft" && !isSalaryCap ? (
        <section className="league-onboarding-step">
          <h2>Set your auto-draft preferences</h2>
          <p>
            This is one of the most important steps. If the draft clock runs out, picks use your saved list
            {draftType === "autopick" ? " (or Big Board)" : ""}.
          </p>
          <div className="league-onboarding-callout">
            <p style={{ margin: 0 }}>
              Open the preferences page, build your list, and <strong>save</strong>. Then return here to finish.
            </p>
          </div>
          <Link
            href={`/leagues/${leagueSlug}/draft/preferences?from=onboarding`}
            className="app-button"
            style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}
          >
            Set draft preferences now →
          </Link>
          <div className="league-onboarding-actions" style={{ marginTop: 20 }}>
            <button type="button" className="app-button app-button--secondary" onClick={goBack}>
              Back
            </button>
            <button type="button" className="app-button" disabled={pending} onClick={verifyPrefsAndFinish}>
              {pending ? "Checking…" : "I've saved my preferences — finish setup"}
            </button>
          </div>
        </section>
      ) : null}

    </div>
  );
}
