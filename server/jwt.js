const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const createToken = payload => {
  var PRIVATE_KEY = fs.readFileSync(path.join(__dirname, 'priv.pem'));
  const token = jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
  return token;
};

//middleware
const verifyToken = async (req, res, next) => {
  let token = req.headers['token'];
  if (token) {
    const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, 'pub.pem'));
    jwt.verify(token, PUBLIC_KEY, function(err, decoded) {
      if (err) {
        return res.json({
          success: false,
          message: 'Token is not valid'
        });
      } else {
        next();
      }
    });
  } else {
    return res.json({
      success: false,
      message: 'Authorization token is not supplied'
    });
  }
};

module.exports = {
  createToken: createToken,
  verifyToken: verifyToken
};
