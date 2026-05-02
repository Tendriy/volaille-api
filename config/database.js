
const { Pool } = require('pg');

const client = new Pool({
    host: process.env.DB_HOST,    // ou '127.0.0.1'
     port: process.env.DB_PORT || 5432,// Port par défaut PostgreSQL
    user: process.env.DB_USER,     // Votre utilisateur
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    max: 10,               // Maximum de connexions dans le pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

// Tester la connexion
client.connect((err, c, release) => {
    if (err) {
        console.error( err.stack);
    } else {
        release();
    }
});

module.exports = client;