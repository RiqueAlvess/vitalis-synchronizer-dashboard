
export interface LocalStorageConfig {
  savedLocally: boolean;
  savedAt: string;
  [key: string]: any;
}

export const localStorageService = {
  saveConfig: (type: string, config: any): boolean => {
    try {
      localStorage.setItem(`api_config_${type}`, JSON.stringify({
        ...config,
        savedLocally: true,
        savedAt: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  },
  
  getConfig: <T>(type: string): (T & Partial<LocalStorageConfig>) | null => {
    try {
      const stored = localStorage.getItem(`api_config_${type}`);
      if (!stored) return null;
      return JSON.parse(stored) as T & Partial<LocalStorageConfig>;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },
  
  isPreviewEnvironment: (): boolean => {
    return window.location.hostname.includes('preview--') || 
           window.location.hostname.includes('.preview.') ||
           window.location.hostname.includes('.lovable.app');
  }
};
