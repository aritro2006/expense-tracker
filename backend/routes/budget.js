const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const Budget  = require('../models/Budget');

router.get('/', auth, async (req, res) => {
  try {
    const list = await Budget.find({ user: req.userId });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const b = await Budget.create({ ...req.body, user: req.userId });
    res.json(b);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Budget.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
