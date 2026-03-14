const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const User    = require('../models/User');
const bcrypt  = require('bcryptjs');

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.put('/', auth, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword, emailNotifications } = req.body;
    const user = await User.findById(req.user.id);
    if (name  !== undefined) user.name  = name;
    if (email !== undefined) user.email = email;
    if (emailNotifications !== undefined) user.emailNotifications = emailNotifications;
    if (currentPassword && newPassword) {
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
      user.password = await bcrypt.hash(newPassword, 10);
    }
    await user.save();
    res.json({ name: user.name, email: user.email, emailNotifications: user.emailNotifications });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
