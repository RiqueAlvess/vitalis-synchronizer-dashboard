
import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { localStorageService } from '@/services/localStorageService';

export interface PreviewModeIndicatorProps {
  className?: string;
}

const PreviewModeIndicator: React.FC<PreviewModeIndicatorProps> = ({ className = "" }) => {
  if (!localStorageService.isPreviewEnvironment()) {
    return null;
  }
  
  return (
    <Alert variant="destructive" className={`mb-4 ${className}`}>
      <AlertTitle>Modo de Prévia</AlertTitle>
      <AlertDescription>
        Você está usando o ambiente de prévia com funcionalidades limitadas. 
        As configurações da API serão salvas apenas localmente neste navegador.
      </AlertDescription>
    </Alert>
  );
};

export default PreviewModeIndicator;
