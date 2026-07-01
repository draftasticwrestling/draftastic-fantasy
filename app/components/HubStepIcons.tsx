function HubStepIconSignup() {
  return (
    <svg className="hub-steps-icon" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="3" />
      <path
        d="M14 54c0-10 8-18 18-18s18 8 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M46 18h10M51 13v10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function HubStepIconDraft() {
  const placements = [-9.5, 11.5, 32.5] as const;

  return (
    <svg className="hub-steps-icon hub-steps-icon--filled" viewBox="0 6 64 34" aria-hidden>
      {placements.map((tx) => (
        <g key={tx} transform={`translate(${tx} 2) scale(0.64)`}>
          <circle cx="32" cy="24" r="9" fill="currentColor" />
          <path d="M13 56c0-11.5 8.5-19 19-19s19 7.5 19 19" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function HubStepIconTrophy() {
  return (
    <svg className="hub-steps-icon" viewBox="0 0 64 64" aria-hidden>
      <path
        d="M18 14h28v8c0 9-6 16-14 16s-14-7-14-16v-8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M18 18H10c0 8 4 12 8 14M46 18h8c0 8-4 12-8 14" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M32 38v8M22 54h20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 54h28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export { HubStepIconSignup, HubStepIconDraft, HubStepIconTrophy };
