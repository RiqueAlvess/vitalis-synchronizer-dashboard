
import React from 'react';
import { cn } from '@/lib/utils';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  className?: string;
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className 
}) => {
  // Define size classes
  const sizeClasses = {
    sm: variant === 'full' ? 'h-6' : 'h-6 w-6',
    md: variant === 'full' ? 'h-8' : 'h-8 w-8',
    lg: variant === 'full' ? 'h-12' : 'h-12 w-12',
  };

  return (
    <div className={cn('flex items-center', className)}>
      <img 
        src={variant === 'full' ? '/logo.svg' : '/logo-icon.svg'} 
        alt="Vitalis" 
        className={sizeClasses[size]}
      />
    </div>
  );
};

export default Logo;
