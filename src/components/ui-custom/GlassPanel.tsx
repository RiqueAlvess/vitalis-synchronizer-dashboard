
import React from 'react';
import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'light' | 'medium' | 'strong';
}

const GlassPanel: React.FC<GlassPanelProps> = ({ 
  children, 
  className,
  intensity = 'medium'
}) => {
  const bgOpacity = {
    light: 'bg-white/40',
    medium: 'bg-white/60',
    strong: 'bg-white/80',
  };
  
  return (
    <div 
      className={cn(
        "rounded-xl border border-white/20 backdrop-blur-md shadow-glass",
        bgOpacity[intensity],
        className
      )}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
