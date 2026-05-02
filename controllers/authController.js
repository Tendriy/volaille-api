const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Inscription
const register = async (req, res) => {
    const { username, email, password, nom_complet } = req.body;


    try {
        // Vérifier si l'utilisateur existe déjà
        const [existing] = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email ou nom d\'utilisateur déjà utilisé' });
        }

        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insérer l'utilisateur
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, nom_complet) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, nom_complet]
        );


        res.status(201).json({ 
            message: 'Utilisateur créé avec succès',
            userId: result.insertId
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'inscription: ' + error.message });
    }
};

// Connexion
const login = async (req, res) => {
    const { email, password } = req.body;


    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const user = users[0];

        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Créer le token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );


        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nom_complet: user.nom_complet
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la connexion: ' + error.message });
    }
};

// Récupérer le profil
const getProfile = async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, nom_complet, created_at FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
};

module.exports = { register, login, getProfile };