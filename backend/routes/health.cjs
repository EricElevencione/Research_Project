const express = require('express');
const router = express.Router();

// Health check endpoint
// Path is '/' because '/api/health' prefix is added in server.cjs
router.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;