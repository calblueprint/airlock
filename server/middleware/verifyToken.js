const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { CONFIG_ROOT } = require('../config/jwt');

const verifyToken = async (req, res, next) => {
  let token = req.headers['token'];
  if (token) {
    const PUBLIC_KEY = fs.readFileSync(path.join(CONFIG_ROOT, 'pub.pem'));
    jwt.verify(token, PUBLIC_KEY, function(err, decoded) {
      if (err) {
        return res.json({
          success: false,
          message: 'Token is not valid',
        });
      } else {
        next();
      }
    });
  } else {
    return res.json({
      success: false,
      message: 'Authorization token is not supplied',
    });
  }
};

module.exports = {
  verifyToken: verifyToken,
};
