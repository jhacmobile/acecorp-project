
import React from 'react';

interface AceCorpLogoProps {
  className?: string;
  color?: string;
  customUrl?: string;
  inverted?: boolean;
}

const AceCorpLogo: React.FC<AceCorpLogoProps> = ({ 
  className, 
  color = '#0ea5e9', 
  customUrl, 
  inverted 
}) => {
  if (customUrl) {
    return <img src={customUrl} alt="AceCorp Logo" className={`${className} object-contain`} />;
  }
  
  const mainColor = inverted ? '#ffffff' : color;
  const circleFill = inverted ? 'rgba(255, 255, 255, 0.1)' : 'white';

  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill={circleFill} stroke={mainColor} strokeWidth="2" />
      <path d="M50 20 L65 40 L50 70 L35 40 Z" fill={mainColor} />
      <circle cx="50" cy="50" r="8" fill={inverted ? 'white' : color} opacity="0.3" />
      <path d="M30 80 Q50 90 70 80" stroke={mainColor} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

export default AceCorpLogo;
