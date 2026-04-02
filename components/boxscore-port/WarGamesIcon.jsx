import React from 'react';

// SVG War Games icon, styled for gold theme
export default function WarGamesIcon({ style = {}, size = 36 }) {
  return (
    <svg
      width={size}
      height={size * 0.8}
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Outer cage base */}
      <rect x="10" y="60" width="80" height="8" rx="2" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Outer cage walls */}
      <rect x="10" y="20" width="80" height="40" rx="2" fill="none" stroke="#FFD700" strokeWidth="2" />
      
      {/* Inner cage base */}
      <rect x="25" y="55" width="50" height="6" rx="2" fill="#C6A04F" stroke="#FFD700" strokeWidth="1" />
      
      {/* Inner cage walls */}
      <rect x="25" y="25" width="50" height="30" rx="2" fill="none" stroke="#FFD700" strokeWidth="1" />
      
      {/* Cage bars - vertical */}
      <line x1="20" y1="20" x2="20" y2="60" stroke="#FFD700" strokeWidth="1" />
      <line x1="30" y1="20" x2="30" y2="60" stroke="#FFD700" strokeWidth="1" />
      <line x1="40" y1="20" x2="40" y2="60" stroke="#FFD700" strokeWidth="1" />
      <line x1="50" y1="20" x2="50" y2="60" stroke="#FFD700" strokeWidth="1" />
      <line x1="60" y1="20" x2="60" y2="60" stroke="#FFD700" strokeWidth="1" />
      <line x1="70" y1="20" x2="70" y2="60" stroke="#FFD700" strokeWidth="1" />
      <line x1="80" y1="20" x2="80" y2="60" stroke="#FFD700" strokeWidth="1" />
      
      {/* Cage bars - horizontal */}
      <line x1="10" y1="30" x2="90" y2="30" stroke="#FFD700" strokeWidth="1" />
      <line x1="10" y1="40" x2="90" y2="40" stroke="#FFD700" strokeWidth="1" />
      <line x1="10" y1="50" x2="90" y2="50" stroke="#FFD700" strokeWidth="1" />
      
      {/* Inner cage bars - vertical */}
      <line x1="35" y1="25" x2="35" y2="55" stroke="#FFD700" strokeWidth="1" />
      <line x1="45" y1="25" x2="45" y2="55" stroke="#FFD700" strokeWidth="1" />
      <line x1="55" y1="25" x2="55" y2="55" stroke="#FFD700" strokeWidth="1" />
      <line x1="65" y1="25" x2="65" y2="55" stroke="#FFD700" strokeWidth="1" />
      
      {/* Inner cage bars - horizontal */}
      <line x1="25" y1="35" x2="75" y2="35" stroke="#FFD700" strokeWidth="1" />
      <line x1="25" y1="45" x2="75" y2="45" stroke="#FFD700" strokeWidth="1" />
      
      {/* Cage top */}
      <rect x="10" y="15" width="80" height="8" rx="2" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Cage center spotlight */}
      <circle cx="50" cy="40" r="6" fill="#FFD700" opacity="0.6" />
      
      {/* Cage corner posts */}
      <circle cx="15" cy="20" r="3" fill="#FFD700" />
      <circle cx="85" cy="20" r="3" fill="#FFD700" />
      <circle cx="15" cy="60" r="3" fill="#FFD700" />
      <circle cx="85" cy="60" r="3" fill="#FFD700" />
    </svg>
  );
} 