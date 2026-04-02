import React from 'react';

// SVG Elimination Chamber icon, styled for gold theme
export default function ChamberIcon({ style = {}, size = 36 }) {
  return (
    <svg
      width={size}
      height={size * 0.8}
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Chamber base */}
      <polygon points="20,70 80,70 90,50 80,30 20,30 10,50" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Chamber walls */}
      <polygon points="15,50 25,35 75,35 85,50 75,65 25,65" fill="#222" stroke="#FFD700" strokeWidth="2" />
      
      {/* Chamber top */}
      <polygon points="25,35 75,35 70,20 30,20" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Chamber pods */}
      <rect x="20" y="40" width="8" height="20" rx="2" fill="#111" stroke="#FFD700" strokeWidth="1" />
      <rect x="72" y="40" width="8" height="20" rx="2" fill="#111" stroke="#FFD700" strokeWidth="1" />
      <rect x="36" y="35" width="8" height="15" rx="2" fill="#111" stroke="#FFD700" strokeWidth="1" />
      <rect x="56" y="35" width="8" height="15" rx="2" fill="#111" stroke="#FFD700" strokeWidth="1" />
      
      {/* Chamber floor grid */}
      <line x1="25" y1="60" x2="75" y2="60" stroke="#FFD700" strokeWidth="1" />
      <line x1="25" y1="65" x2="75" y2="65" stroke="#FFD700" strokeWidth="1" />
      <line x1="35" y1="55" x2="35" y2="70" stroke="#FFD700" strokeWidth="1" />
      <line x1="45" y1="55" x2="45" y2="70" stroke="#FFD700" strokeWidth="1" />
      <line x1="55" y1="55" x2="55" y2="70" stroke="#FFD700" strokeWidth="1" />
      <line x1="65" y1="55" x2="65" y2="70" stroke="#FFD700" strokeWidth="1" />
      
      {/* Chamber center */}
      <circle cx="50" cy="50" r="8" fill="#FFD700" stroke="#C6A04F" strokeWidth="2" />
      
      {/* Chamber lighting */}
      <circle cx="30" cy="25" r="3" fill="#FFD700" opacity="0.8" />
      <circle cx="70" cy="25" r="3" fill="#FFD700" opacity="0.8" />
      <circle cx="50" cy="15" r="3" fill="#FFD700" opacity="0.8" />
    </svg>
  );
} 