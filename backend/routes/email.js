const express = require('express');
const router  = express.Router();

router.post('/send', (req, res) => {
  res.json({ success: false, message: 'Email service temporarily disabled' });
});

router.post('/test', (req, res) => {
  res.json({ success: false, message: 'Email service temporarily disabled' });
});

router.post('/send-weekly', (req, res) => {
  res.json({ success: false, message: 'Email service temporarily disabled' });
});

module.exports = router;
