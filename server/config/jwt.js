const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const CONFIG_ROOT = __dirname;

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

module.exports = {
  OPTIONS: OPTIONS,
  XFIELDS: XFIELDS,
  CONFIG_ROOT: CONFIG_ROOT,
};
