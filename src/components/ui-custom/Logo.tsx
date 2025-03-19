
import React from 'react';
import { cn } from '@/lib/utils';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
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
    xl: variant === 'full' ? 'h-16' : 'h-16 w-16',
    '2xl': variant === 'full' ? 'h-24' : 'h-24 w-24',
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
