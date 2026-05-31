const { Pool } = require('pg');

const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    statement_timeout: 10000, 
    query_timeout: 10000,
    idle_in_transaction_session_timeout: 10000
};

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.co')) {
    poolConfig.ssl = { rejectUnauthorized: false };
} else {
    poolConfig.ssl = false;
}

const client = new Pool(poolConfig);

client.connect((err, c, release) => {
    if (err) {
        console.error('Erreur de connexion à la BD:', err.stack);
    } else {
        console.log('Connecté à la base de données avec succès');
        release();
    }
});

module.exports = client;