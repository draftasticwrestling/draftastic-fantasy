import { HubStepIconDraft, HubStepIconSignup, HubStepIconTrophy } from "@/app/components/HubStepIcons";

const steps = [
  {
    label: "Sign up",
    icon: HubStepIconSignup,
    text: "SIGN-UP",
  },
  {
    label: "Draft your team",
    icon: HubStepIconDraft,
    text: "DRAFT TEAM",
  },
  {
    label: "Start playing",
    icon: HubStepIconTrophy,
    text: "START PLAYING",
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
                <span className="hub-step-label-main">{step.text}</span>
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
