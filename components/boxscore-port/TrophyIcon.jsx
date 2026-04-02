import React from 'react';

// SVG trophy icon for Royal Rumble winners, styled for gold theme
export default function TrophyIcon({ style = {}, size = 36 }) {
  return (
    <svg
      width={size}
      height={size * 0.9}
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Trophy base */}
      <rect x="35" y="75" width="30" height="8" rx="2" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Trophy stem */}
      <rect x="47" y="45" width="6" height="30" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Trophy cup */}
      <ellipse cx="50" cy="40" rx="20" ry="15" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      <ellipse cx="50" cy="40" rx="15" ry="10" fill="#FFD700" stroke="#C6A04F" strokeWidth="1" />
      
      {/* Trophy handles */}
      <path d="M30 35 Q25 30 30 25 Q35 30 30 35" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      <path d="M70 35 Q75 30 70 25 Q65 30 70 35" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Trophy top rim */}
      <ellipse cx="50" cy="25" rx="22" ry="5" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Trophy jewels */}
      <circle cx="40" cy="35" r="3" fill="#FFD700" />
      <circle cx="50" cy="35" r="3" fill="#FFD700" />
      <circle cx="60" cy="35" r="3" fill="#FFD700" />
      
      {/* Trophy decorative lines */}
      <line x1="35" y1="45" x2="65" y2="45" stroke="#FFD700" strokeWidth="1" />
      <line x1="35" y1="50" x2="65" y2="50" stroke="#FFD700" strokeWidth="1" />
      
      {/* Trophy shine */}
      <ellipse cx="45" cy="38" rx="8" ry="6" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.6" />
    </svg>
  );
} 