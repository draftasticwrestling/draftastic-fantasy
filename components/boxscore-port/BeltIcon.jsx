import React from 'react';

const BeltIcon = ({ size = 24, color = '#C6A04F' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dark strap background */}
      <rect
        x="2"
        y="8"
        width="20"
        height="8"
        rx="1"
        fill="#333"
        stroke="#333"
      />
      
      {/* Central plate */}
      <ellipse
        cx="12"
        cy="12"
        rx="6"
        ry="3.5"
        fill={color}
        stroke={color}
      />
      
      {/* Left side plate */}
      <rect
        x="4"
        y="9.5"
        width="3"
        height="5"
        rx="0.5"
        fill={color}
        stroke={color}
      />
      
      {/* Right side plate */}
      <rect
        x="17"
        y="9.5"
        width="3"
        height="5"
        rx="0.5"
        fill={color}
        stroke={color}
      />
      
      {/* Globe in center */}
      <circle
        cx="12"
        cy="12"
        r="1.5"
        fill="#333"
      />
      {/* Globe lines */}
      <line x1="10.5" y1="12" x2="13.5" y2="12" stroke="#333" strokeWidth="0.5" />
      <line x1="12" y1="10.5" x2="12" y2="13.5" stroke="#333" strokeWidth="0.5" />
      
      {/* Stars on central plate */}
      <path
        d="M10.5 11.5 L11 10.5 L11.5 11.5 L10.5 12.5 L9.5 11.5 Z"
        fill="#333"
      />
      <path
        d="M13.5 11.5 L14 10.5 L14.5 11.5 L13.5 12.5 L12.5 11.5 Z"
        fill="#333"
      />
      
      {/* Stars on side plates */}
      <path
        d="M5.5 11.5 L6 10.5 L6.5 11.5 L5.5 12.5 L4.5 11.5 Z"
        fill="#333"
      />
      <path
        d="M18.5 11.5 L19 10.5 L19.5 11.5 L18.5 12.5 L17.5 11.5 Z"
        fill="#333"
      />
      
      {/* Decorative studs/rivets */}
      <rect x="3" y="9" width="0.5" height="0.5" fill="#333" />
      <rect x="3" y="14.5" width="0.5" height="0.5" fill="#333" />
      <rect x="20.5" y="9" width="0.5" height="0.5" fill="#333" />
      <rect x="20.5" y="14.5" width="0.5" height="0.5" fill="#333" />
    </svg>
  );
};

export default BeltIcon; 