
import React from 'react';
import PageTransition from './PageTransition';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  actions?: React.ReactNode;  // Added this property to fix the error
  containerClassName?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  rightContent,
  actions,  // Added this prop to the destructuring
  containerClassName,
}) => {
  return (
    <PageTransition>
      <div className="pt-20 pb-12 min-h-screen">
        {(title || subtitle || rightContent || actions) && (
          <header className="mb-8 px-6 md:px-8">
            <div className="container mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  {title && (
                    <h1 className="text-2xl md:text-3xl font-semibold">{title}</h1>
                  )}
                  {subtitle && (
                    <p className="text-muted-foreground">{subtitle}</p>
                  )}
                </div>
                {actions && (
                  <div className="flex items-center gap-2">{actions}</div>
                )}
                {rightContent && (
                  <div className="flex items-center gap-4">{rightContent}</div>
                )}
              </div>
            </div>
          </header>
        )}
        
        <main className={cn("container mx-auto px-4 md:px-8", containerClassName)}>
          {children}
        </main>
      </div>
    </PageTransition>
  );
};

export default DashboardLayout;
