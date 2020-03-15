const tokenManagement = require('../utils/tokenManagement');
const checkTokenRevocation = async (req, res, next) => {
  let token = req.headers['token'];
  if (token) {
    value = await tokenManagement.isTokenRevoked(token);
    if (value != null) {
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
  checkTokenRevocation: checkTokenRevocation,
};
