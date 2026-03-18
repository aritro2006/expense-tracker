const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const Goal    = require('../models/Goal');

router.get('/', auth, async (req, res) => {
  try {
    const list = await Goal.find({ user: req.userId });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const g = await Goal.create({ ...req.body, user: req.userId });
    res.json(g);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const g = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.userId }, req.body, { new: true }
    );
    res.json(g);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Goal.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
