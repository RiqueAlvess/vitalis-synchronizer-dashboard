
import { query } from './dbService';
import * as bcrypt from 'bcrypt';

export interface User {
  id: string;
  email: string;
  companyName: string;
  plan: 'free' | 'premium';
}

// Token constants
const TOKEN_KEY = 'vitalis_auth_token';
const USER_KEY = 'vitalis_user';
const SALT_ROUNDS = 10;

export const authService = {
  // Login com email e senha
  async login(email: string, password: string): Promise<User> {
    try {
      // Buscar usuário pelo email
      const userResult = await query(
        'SELECT id, email, company_name, password_hash FROM users WHERE email = $1',
        [email]
      );
      
      const user = userResult.rows[0];
      
      if (!user) {
        throw new Error('Credenciais inválidas');
      }
      
      // Verificar a senha
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        throw new Error('Credenciais inválidas');
      }
      
      // Atualizar último login
      await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      // Criar token de autenticação
      const token = btoa(JSON.stringify({ id: user.id, exp: Date.now() + 24 * 60 * 60 * 1000 }));
      
      // Salvar token no localStorage
      localStorage.setItem(TOKEN_KEY, token);
      
      // Mapear dados do usuário para formato da interface
      const userData: User = {
        id: user.id.toString(),
        email: user.email,
        companyName: user.company_name,
        plan: 'free' // Por padrão todos são 'free'
      };
      
      // Salvar dados do usuário no localStorage
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  },
  
  // Cadastrar novo usuário
  async register(email: string, password: string, companyName: string): Promise<User> {
    try {
      // Verificar se já existe usuário com este email
      const checkResult = await query('SELECT id FROM users WHERE email = $1', [email]);
      
      if (checkResult.rows.length > 0) {
        throw new Error('Este email já está cadastrado');
      }
      
      // Hash da senha
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Inserir novo usuário
      const result = await query(
        'INSERT INTO users (email, password_hash, company_name) VALUES ($1, $2, $3) RETURNING id',
        [email, passwordHash, companyName]
      );
      
      const userId = result.rows[0].id;
      
      // Criar configurações de API padrão para o novo usuário
      await query(
        'INSERT INTO api_configurations (user_id, api_type) VALUES ($1, $2), ($1, $3), ($1, $4)',
        [userId, 'company', 'employee', 'absenteeism']
      );
      
      // Criar token de autenticação
      const token = btoa(JSON.stringify({ id: userId, exp: Date.now() + 24 * 60 * 60 * 1000 }));
      
      // Salvar token no localStorage
      localStorage.setItem(TOKEN_KEY, token);
      
      // Mapear dados do usuário para formato da interface
      const userData: User = {
        id: userId.toString(),
        email,
        companyName,
        plan: 'free'
      };
      
      // Salvar dados do usuário no localStorage
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Erro no cadastro:', error);
      throw error;
    }
  },
  
  // Verificar se usuário está logado
  async getCurrentUser(): Promise<User | null> {
    const userJson = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (!userJson || !token) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(atob(token));
      
      // Verificar se token expirou
      if (parsed.exp < Date.now()) {
        this.logout();
        return null;
      }
      
      // Verificar se usuário ainda existe no banco
      const userResult = await query('SELECT id FROM users WHERE id = $1', [parsed.id]);
      
      if (userResult.rows.length === 0) {
        this.logout();
        return null;
      }
      
      return JSON.parse(userJson) as User;
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      this.logout();
      return null;
    }
  },
  
  // Deslogar usuário
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  
  // Verificar se token existe
  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }
};
