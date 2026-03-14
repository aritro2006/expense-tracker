const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const cron     = require('node-cron');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budget',       require('./routes/budget'));
app.use('/api/ai',           require('./routes/ai'));
app.use('/api/recurring',    require('./routes/recurring'));
app.use('/api/goals',        require('./routes/goals'));
app.use('/api/profile',      require('./routes/profile'));
app.use('/api/email',        require('./routes/email'));

// Auto send weekly summary every Sunday at 9 AM
cron.schedule('0 9 * * 0', async () => {
  console.log('Running weekly email cron job...');
  try {
    const User        = require('./models/User');
    const { sendWeeklySummaryEmail } = require('./routes/email');
    const users = await User.find({});
    for (const user of users) {
      await sendWeeklySummaryEmail(user._id, user.email, user.name);
    }
    console.log(`Weekly emails sent to ${users.length} users`);
  } catch (err) { console.error('Cron email error:', err); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
