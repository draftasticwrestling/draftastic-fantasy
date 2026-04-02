import React from 'react';

// SVG crown icon for King/Queen of the Ring, styled for gold theme
export default function CrownIcon({ style = {}, size = 36 }) {
  return (
    <svg
      width={size}
      height={size * 0.8}
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Crown base */}
      <rect x="10" y="50" width="80" height="8" rx="2" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Crown jewels */}
      <circle cx="25" cy="45" r="8" fill="#FFD700" stroke="#C6A04F" strokeWidth="2" />
      <circle cx="50" cy="40" r="10" fill="#FFD700" stroke="#C6A04F" strokeWidth="2" />
      <circle cx="75" cy="45" r="8" fill="#FFD700" stroke="#C6A04F" strokeWidth="2" />
      
      {/* Crown points */}
      <polygon points="20,45 25,25 30,45" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      <polygon points="45,40 50,20 55,40" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      <polygon points="70,45 75,25 80,45" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Crown band */}
      <rect x="15" y="35" width="70" height="6" rx="3" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Decorative details */}
      <circle cx="25" cy="38" r="2" fill="#FFD700" />
      <circle cx="50" cy="38" r="2" fill="#FFD700" />
      <circle cx="75" cy="38" r="2" fill="#FFD700" />
      
      {/* Crown arches */}
      <path d="M20 45 Q25 35 30 45" stroke="#FFD700" strokeWidth="2" fill="none" />
      <path d="M45 40 Q50 30 55 40" stroke="#FFD700" strokeWidth="2" fill="none" />
      <path d="M70 45 Q75 35 80 45" stroke="#FFD700" strokeWidth="2" fill="none" />
    </svg>
  );
} 