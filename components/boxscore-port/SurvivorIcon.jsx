import React from 'react';

// SVG Survivor Series icon, styled for gold theme
export default function SurvivorIcon({ style = {}, size = 36 }) {
  return (
    <svg
      width={size}
      height={size * 0.9}
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Shield base */}
      <path d="M20 20 L50 10 L80 20 L80 70 L50 80 L20 70 Z" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      
      {/* Shield inner */}
      <path d="M25 25 L50 15 L75 25 L75 65 L50 75 L25 65 Z" fill="#222" stroke="#FFD700" strokeWidth="1" />
      
      {/* Shield center */}
      <path d="M30 30 L50 20 L70 30 L70 60 L50 70 L30 60 Z" fill="#FFD700" stroke="#C6A04F" strokeWidth="1" />
      
      {/* Shield emblem */}
      <circle cx="50" cy="45" r="8" fill="#C6A04F" stroke="#FFD700" strokeWidth="2" />
      <text x="50" y="50" textAnchor="middle" fill="#FFD700" fontSize="12" fontWeight="bold">S</text>
      
      {/* Shield decorative lines */}
      <line x1="35" y1="35" x2="65" y2="35" stroke="#FFD700" strokeWidth="1" />
      <line x1="35" y1="55" x2="65" y2="55" stroke="#FFD700" strokeWidth="1" />
      
      {/* Shield rivets */}
      <circle cx="30" cy="30" r="2" fill="#FFD700" />
      <circle cx="70" cy="30" r="2" fill="#FFD700" />
      <circle cx="30" cy="60" r="2" fill="#FFD700" />
      <circle cx="70" cy="60" r="2" fill="#FFD700" />
      
      {/* Shield border details */}
      <path d="M20 20 L50 10" stroke="#FFD700" strokeWidth="1" />
      <path d="M50 10 L80 20" stroke="#FFD700" strokeWidth="1" />
      <path d="M80 20 L80 70" stroke="#FFD700" strokeWidth="1" />
      <path d="M80 70 L50 80" stroke="#FFD700" strokeWidth="1" />
      <path d="M50 80 L20 70" stroke="#FFD700" strokeWidth="1" />
      <path d="M20 70 L20 20" stroke="#FFD700" strokeWidth="1" />
    </svg>
  );
} 