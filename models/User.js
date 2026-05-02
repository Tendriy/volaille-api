const db = require('../config/database');

class User {
    // Trouver un utilisateur par email
    static async findByEmail(email) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return rows[0];
    }

    // Trouver un utilisateur par username
    static async findByUsername(username) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        return rows[0];
    }

    // Trouver un utilisateur par ID
    static async findById(id) {
        const [rows] = await db.query(
            'SELECT id, username, email, nom_complet, created_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    // Créer un nouvel utilisateur
    static async create(userData) {
        const { username, email, password, nom_complet } = userData;
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, nom_complet) VALUES (?, ?, ?, ?)',
            [username, email, password, nom_complet]
        );
        return result.insertId;
    }

    // Vérifier si l'email ou username existe déjà
    static async exists(email, username) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        return rows.length > 0;
    }
}

module.exports = User;