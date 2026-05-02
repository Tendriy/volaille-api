
const { Pool } = require('pg');

const client = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 10000, 
    query_timeout: 10000,
    idle_in_transaction_session_timeout: 10000
});

// Tester la connexion
client.connect((err, c, release) => {
    if (err) {
        console.error(err.stack);
    } else {
        release();
    }
});

module.exports = client;