import React from 'react';

// SVG Money in the Bank briefcase icon, styled for gold theme
export default function BriefcaseIcon({ style = {}, size = 36 }) {
  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 100 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Briefcase body */}
      <rect x="10" y="20" width="80" height="45" rx="4" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Briefcase handle */}
      <rect x="35" y="15" width="30" height="8" rx="4" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Briefcase latch */}
      <rect x="45" y="18" width="10" height="4" rx="2" fill="#FFD700" />
      
      {/* Dollar sign */}
      <text x="50" y="45" textAnchor="middle" fill="#FFD700" fontSize="16" fontWeight="bold">$</text>
      
      {/* Decorative lines */}
      <line x1="20" y1="30" x2="80" y2="30" stroke="#FFD700" strokeWidth="1" />
      <line x1="20" y1="35" x2="80" y2="35" stroke="#FFD700" strokeWidth="1" />
      <line x1="20" y1="40" x2="80" y2="40" stroke="#FFD700" strokeWidth="1" />
      
      {/* Corner decorations */}
      <circle cx="15" cy="25" r="2" fill="#FFD700" />
      <circle cx="85" cy="25" r="2" fill="#FFD700" />
      <circle cx="15" cy="60" r="2" fill="#FFD700" />
      <circle cx="85" cy="60" r="2" fill="#FFD700" />
    </svg>
  );
} 