
import React from 'react';

export interface PreviewModeIndicatorProps {
  className?: string;
}

const PreviewModeIndicator: React.FC<PreviewModeIndicatorProps> = ({ className = "" }) => {
  // Always return null to hide the preview mode indicator
  return null;
};

export default PreviewModeIndicator;
