
// This is a simulated auth service - in a real app you would connect to your backend API

export interface User {
  id: string;
  email: string;
  companyName: string;
  plan: 'free' | 'premium';
}

// Simulated users for demo
const DEMO_USERS = [
  {
    id: '1',
    email: 'demo@example.com',
    password: 'demo123',
    companyName: 'Empresa Demo',
    plan: 'free' as const,
  }
];

const TOKEN_KEY = 'vitalis_auth_token';
const USER_KEY = 'vitalis_user';

export const authService = {
  // Login with email and password
  async login(email: string, password: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
    
    const user = DEMO_USERS.find(u => u.email === email && u.password === password);
    
    if (!user) {
      throw new Error('Credenciais inválidas');
    }
    
    const token = btoa(JSON.stringify({ id: user.id, exp: Date.now() + 24 * 60 * 60 * 1000 }));
    
    localStorage.setItem(TOKEN_KEY, token);
    
    // Store user without password
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem(USER_KEY, JSON.stringify(userWithoutPassword));
    
    return userWithoutPassword;
  },
  
  // Register new user
  async register(email: string, password: string, companyName: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    
    // In a real app, this would make an API call
    // For demo, simulate registration success
    
    const user = {
      id: Math.random().toString(36).substring(2, 9),
      email,
      companyName,
      plan: 'free' as const,
    };
    
    const token = btoa(JSON.stringify({ id: user.id, exp: Date.now() + 24 * 60 * 60 * 1000 }));
    
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    return user;
  },
  
  // Check if user is logged in
  async getCurrentUser(): Promise<User | null> {
    const userJson = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (!userJson || !token) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(atob(token));
      
      // Check if token is expired
      if (parsed.exp < Date.now()) {
        this.logout();
        return null;
      }
      
      return JSON.parse(userJson) as User;
    } catch (error) {
      this.logout();
      return null;
    }
  },
  
  // Log out user
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  
  // Check if token exists
  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }
};
