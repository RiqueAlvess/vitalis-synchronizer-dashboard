
import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    positive?: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  trend,
  icon,
  className,
  valueClassName,
}) => {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      
      <div className="mt-3">
        <h3 
          className={cn(
            "text-2xl font-semibold tracking-tight",
            valueClassName
          )}
        >
          {value}
        </h3>
        
        {trend && (
          <div className="flex items-center mt-1">
            <span 
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                trend.positive 
                  ? "text-green-800 bg-green-100" 
                  : "text-red-800 bg-red-100"
              )}
            >
              {trend.positive ? '+' : ''}{trend.value}%
            </span>
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </div>
        )}
        
        {!trend && description && (
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
};

export default StatCard;
