// routes/settings.js
const express = require('express');

module.exports = (merchantSettings, emailService) => {
  const router = express.Router();
  
  router.get('/', async (req, res) => {
    res.json({
      general: { codEnabled: true, companyName: 'RT Solutions' }
    });
  });
  
  return router;
};