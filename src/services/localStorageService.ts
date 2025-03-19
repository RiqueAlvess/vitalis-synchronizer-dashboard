
import { ApiConfigType } from './api';

interface LocalStorageService {
  isPreviewEnvironment: () => boolean;
  getConfig: <T>(type: ApiConfigType) => T | null;
  saveConfig: (type: ApiConfigType, config: any) => boolean;
}

export const localStorageService: LocalStorageService = {
  isPreviewEnvironment: () => {
    return false; // Set to false to disable preview/mock mode entirely
  },
  
  getConfig: <T>(type: ApiConfigType): T | null => {
    try {
      const storedConfig = localStorage.getItem(`api_config_${type}`);
      if (storedConfig) {
        return JSON.parse(storedConfig) as T;
      }
      return null;
    } catch (error) {
      console.error(`Error retrieving ${type} config from localStorage:`, error);
      return null;
    }
  },
  
  saveConfig: (type: ApiConfigType, config: any): boolean => {
    try {
      localStorage.setItem(`api_config_${type}`, JSON.stringify(config));
      return true;
    } catch (error) {
      console.error(`Error saving ${type} config to localStorage:`, error);
      return false;
    }
  }
};
