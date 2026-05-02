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

// Middleware
app.use(cors());
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