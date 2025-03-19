
import { ApiConfigType, ApiConfig, EmployeeApiConfig, AbsenteeismApiConfig } from './api';

interface LocalStorageService {
  isPreviewEnvironment: () => boolean;
  getConfig: <T>(type: ApiConfigType) => T | null;
  saveConfig: (type: ApiConfigType, config: any) => boolean;
}

export const localStorageService: LocalStorageService = {
  isPreviewEnvironment: () => {
    return false; // Always disable preview/mock mode
  },
  
  getConfig: <T>(type: ApiConfigType): T | null => {
    // Returning null to force using the database instead of localStorage
    return null;
  },
  
  saveConfig: (type: ApiConfigType, config: any): boolean => {
    // We won't save to localStorage anymore, this is just a dummy function that returns true
    // to prevent errors in existing code
    console.log('LocalStorage saving is disabled, configurations will be saved to the database only');
    return true;
  }
};
