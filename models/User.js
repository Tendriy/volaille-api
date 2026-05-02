const db = require('../config/database');

class User {
    // Trouver un utilisateur par email
    static async findByEmail(email) {
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }

    // Trouver un utilisateur par username
    static async findByUsername(username) {
        const result = await db.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0];
    }

    // Trouver un utilisateur par ID
    static async findById(id) {
        const result = await db.query(
            'SELECT id, username, email, nom_complet, created_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    // Créer un nouvel utilisateur
    static async create(userData) {
        const { username, email, password, nom_complet } = userData;
        const result = await db.query(
            `INSERT INTO users (username, email, password, nom_complet) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id`,
            [username, email, password, nom_complet]
        );
        return result.rows[0].id;
    }

    // Vérifier si l'email ou username existe déjà
    static async exists(email, username) {
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        return result.rows.length > 0;
    }
}

module.exports = User;