const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { OPTIONS } = require('../config/jwt');
const { XFIELDS } = require('../config/jwt');
const { CONFIG_ROOT } = require('../config/jwt');

const createToken = payload => {
  let safePayload = createSafePayload(payload);
  const PRIVATE_KEY = fs.readFileSync(path.join(CONFIG_ROOT, 'priv.pem'));
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

module.exports = {
  createToken: createToken,
};
