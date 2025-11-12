// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me (requiere autenticación)
router.get('/me', protect, getMe);

module.exports = router;