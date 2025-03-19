
export interface User {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  jobTitle?: string;
  isPremium: boolean;
  token?: string;
  refreshToken?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, companyName: string) => Promise<User>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  saveSettings: (settings: any) => Promise<boolean>;
  getSettings: () => Promise<any>;
  updateProfile: (profile: Partial<User>) => Promise<User>;
}

export interface AuthStateManager {
  setUser: (user: User) => void;
  clearUser: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}
