
import React from 'react';
import { cn } from '@/lib/utils';

type VitalisLogoProps = {
  className?: string;
  height?: number;
  width?: number;
};

export const VitalisLogo: React.FC<VitalisLogoProps> = ({ 
  className,
  height = 40,
  width
}) => {
  // If width is not provided, maintain the aspect ratio
  const calculatedWidth = width || (height * 3.5);
  
  return (
    <div className={cn('flex items-center', className)}>
      <img 
        src="/logo.svg" 
        alt="Vitalis" 
        height={height}
        width={calculatedWidth}
        className="h-auto"
      />
    </div>
  );
};

export default VitalisLogo;
