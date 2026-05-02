const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// Import des routes
const authRoutes = require('./routes/authRoutes');
const lotRoutes = require('./routes/lotRoutes');
const suiviRoutes = require('./routes/suiviRoutes');
const stockRoutes = require('./routes/stockRoutes');
const vaccinRoutes = require('./routes/vaccinRoutes');
const venteRoutes = require('./routes/venteRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes'); // <-- AJOUT

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`Origin bloquée par CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};


// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/lots', lotRoutes);
app.use('/api/suivi', suiviRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/vaccins', vaccinRoutes);
app.use('/api/ventes', venteRoutes);
app.use('/api/dashboard', dashboardRoutes); // <-- AJOUT

// Route de test
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'API VOLAILLE CONNECT fonctionne' });
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(` Serveur démarré sur le port ${PORT}`);
    console.log(` API disponible sur http://localhost:${PORT}/api`);
    console.log(` Dashboard disponible sur http://localhost:${PORT}/api/dashboard`);
});