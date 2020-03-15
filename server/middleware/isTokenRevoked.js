const { isTokenRevoked } = require('../utils/tokenManagement');
const isTokenRevoked = (req, res, next) => {
  let token = req.headers['token'];
  if (token) {
    value = isTokenRevoked(token);
    if (value != undefined) {
      return res.json({
        success: false,
        message: 'Token has been revoked',
      });
    } else {
      next();
    }
  } else {
    return res.json({
      success: false,
      message: 'Authorization token is not supplied',
    });
  }
};

module.exports = {
  isTokenRevoked: isTokenRevoked,
};
