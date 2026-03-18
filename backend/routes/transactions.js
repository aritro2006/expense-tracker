const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');

router.get('/', auth, async (req, res) => {
  try {
    const list = await Transaction.find({ user: req.userId }).sort({ date: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const t = await Transaction.create({ ...req.body, user: req.userId });
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const t = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.userId }, req.body, { new: true }
    );
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Transaction.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
