
import { Pool } from 'pg';

// Configuração da conexão com o banco de dados
const pool = new Pool({
  host: 'dpg-cvblvjd2ng1s73efitig-a.oregon-postgres.render.com',
  port: 5432,
  database: 'db_vitalis',
  user: 'db_vitalis_user',
  password: 'skk1guiKUO5fe77SDZJGzHHZhXu2jitP',
  ssl: {
    rejectUnauthorized: false // Necessário para conexões com Render ou similar
  }
});

// Test connection on init
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conexão com o banco de dados estabelecida com sucesso!');
  }
});

// Executa uma query no banco de dados
export const query = async (text: string, params?: any[]) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executada em', duration, 'ms', { text, params });
    return res;
  } catch (error) {
    console.error('Erro ao executar query:', error);
    throw error;
  }
};

// Fecha a pool de conexões (para uso em testes ou ao encerrar a aplicação)
export const closePool = async () => {
  await pool.end();
};

export default {
  query,
  closePool,
  pool
};
