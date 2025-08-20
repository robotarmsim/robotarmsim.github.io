import React from 'react';

interface IconWrapperProps {
  size?: number; // height in px
  color?: string;
  children: React.ReactNode; // the <path> etc.
}

export const IconWrapper: React.FC<IconWrapperProps> = ({
  size = 64,
  color = 'black',
  children
}) => {
  return (
    <svg
      viewBox="0 0 135 206.38"
      width={(135 / 206.38) * size}
      height={size}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {children}
    </svg>
  );
};
