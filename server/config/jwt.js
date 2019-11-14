const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// jsonwebtoken options
// https://github.com/auth0/node-jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback
const OPTIONS = {
  algorithm: 'RS256',
  expiresIn: '1d',
};

// fields to remove from payload
const XFIELDS = {
  PASSWORD: 'password',
};

const createToken = payload => {
  let safePayload = createSafePayload(payload);
  const PRIVATE_KEY = fs.readFileSync(path.join(__dirname, 'priv.pem'));
  const token = jwt.sign(safePayload, PRIVATE_KEY, { ...OPTIONS });
  return token;
};

const createSafePayload = payload => {
  let fields = payload.fields;
  if (fields) {
    Object.keys(XFIELDS).forEach(key => {
      let value = XFIELDS[key];
      if (fields.hasOwnProperty(value)) {
        delete fields[`${value}`];
      }
    });
  }
  return payload;
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
  createToken: createToken,
  verifyToken: verifyToken,
};
