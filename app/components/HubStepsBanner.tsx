import { HubStepIconDraft, HubStepIconSignup, HubStepIconTrophy } from "@/app/components/HubStepIcons";

const steps = [
  {
    label: "Sign up",
    icon: HubStepIconSignup,
    lines: [{ text: "SIGN-UP", accent: false }],
  },
  {
    label: "Draft your team",
    icon: HubStepIconDraft,
    lines: [
      { text: "DRAFT", accent: false },
      { text: "YOUR TEAM", accent: true },
    ],
  },
  {
    label: "Start playing",
    icon: HubStepIconTrophy,
    lines: [
      { text: "START", accent: false },
      { text: "PLAYING", accent: true },
    ],
  },
] as const;

export default function HubStepsBanner() {
  return (
    <div className="hub-steps-banner" aria-label="How to play">
      <div className="hub-steps-grid">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="hub-step hub-step--static" aria-label={step.label}>
              {index > 0 ? <span className="hub-step-divider" aria-hidden /> : null}
              <Icon />
              <div className="hub-step-label">
                {step.lines.map((line) => (
                  <span
                    key={line.text}
                    className={line.accent ? "hub-step-label-sub" : "hub-step-label-main"}
                  >
                    {line.text}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hub-steps-cta-strip">
        <p className="hub-steps-cta-text">NEW LEAGUES START EVERY MONDAY!</p>
      </div>
    </div>
  );
}
