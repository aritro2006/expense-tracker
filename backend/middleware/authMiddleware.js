const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  let token = req.headers['authorization'] || req.headers['Authorization'];

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Please login again.' });
  }

  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({ message: 'Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id || decoded.user?.id || decoded._id || decoded.user?._id
    };

    if (!req.user.id) {
      return res.status(401).json({ message: 'Token payload invalid. Please login again.' });
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ message: 'Invalid token. Please login again.' });
  }
};
