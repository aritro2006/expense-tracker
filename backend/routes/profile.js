const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const auth     = require('../middleware/authMiddleware');
const User     = require('../models/User');

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('GET profile error:', err.message);
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, email, currentPassword, newPassword, emailNotifications } = req.body;

    if (name)  user.name  = name.trim();
    if (email) user.email = email.toLowerCase().trim();

    if (emailNotifications !== undefined) {
      user.emailNotifications = emailNotifications;
    }

    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });
      if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
      user.password = await bcrypt.hash(newPassword, 12);
    }

    await user.save();
    res.json({
      name:               user.name,
      email:              user.email,
      emailNotifications: user.emailNotifications
    });
  } catch (err) {
    console.error('PUT profile error:', err.message);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;
