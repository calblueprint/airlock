require('dotenv').config();
const JWT = require('../lib/jwt');
const util = require('util');
const request = util.promisify(require('request'));
const bcrypt = require('bcrypt');
const isEmpty = require('lodash/isEmpty');
const AirtableRoute = require('../utils/AirtableRoute');
const { isTokenRevoked, revokeToken } = require('../utils/tokenManagement');

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_API_VERSION,
  AIRTABLE_USER_AGENT,
  DISABLE_HASH_PASSWORD = false,
  AIRTABLE_USERNAME_COLUMN_NAME,
  SALT_ROUNDS = 5,
} = process.env;

const HEADERS = {
  authorization: 'Bearer ' + AIRTABLE_API_KEY,
  'x-api-version': AIRTABLE_API_VERSION,
  'x-airtable-application-id': AIRTABLE_BASE_ID,
  'User-Agent': AIRTABLE_USER_AGENT,
};

const REQUEST_OPTIONS = {
  json: true,
  timeout: 5000,
  headers: HEADERS,
  agentOptions: {
    rejectUnauthorized: false,
  },
};

module.exports = {
  async login(req, res, next) {
    if (isEmpty(req.user)) {
      const payload = { success: false, message: 'user does not exists' };
      return res.status(422).send(payload);
    }
    const password = req.body.password;
    if (!JSON.parse(DISABLE_HASH_PASSWORD)) {
      const match = await bcrypt.compare(password, req.user.fields.password);
      if (match) {
        const token = JWT.createToken(req.user);
        const payload = {
          success: true,
          token: token,
          user: req.user,
        };
        return res.status(200).json(payload);
      }
      const payload = { success: false, error: 'Invalid login' };
      return res.status(422).send(payload);
    }
    const match = req.user.fields.password === password;
    if (match) {
      const token = JWT.createToken(req.user);
      const payload = {
        success: true,
        token: token,
        user: req.user,
      };
      return res.status(200).json(payload);
    }
    const payload = { success: false, error: 'Invalid login' };
    return res.status(422).send(payload);
  },

  async register(req, res, next) {
    if (!isEmpty(req.user)) {
      const payload = { success: false, message: 'user exists' };
      return res.status(422).send(payload);
    }

    const fields = req.body.fields ? req.body.fields : {};
    const urlCreate = AirtableRoute.users();
    const hash = await bcrypt.hash(
      req.body.password,
      parseInt(SALT_ROUNDS, 10),
    );
    let newUser;
    try {
      ({
        body: { error = null, ...newUser },
      } = await request({
        ...REQUEST_OPTIONS,
        ...urlCreate,
        ...{
          body: {
            fields: {
              [AIRTABLE_USERNAME_COLUMN_NAME]: `${req.body.username}`,
              password: `${
                !JSON.parse(DISABLE_HASH_PASSWORD) ? hash : req.body.password
              }`,
              ...fields,
            },
          },
        },
        method: 'POST',
      }));
      if (error) {
        throw error;
      }
    } catch (err) {
      return next(err);
    }

    if (!isEmpty(newUser)) {
      const token = JWT.createToken(newUser);
      const payload = { success: true, token: token, user: newUser };
      return res.status(200).json(payload);
    }
    const payload = { success: false };
    return res.status(422).send(payload);
  },
  async logout(req, res, next) {
    let token = req.headers['token'];
    if (token) {
      value = isTokenRevoked(token);
      if (value != undefined) {
        return res.json({
          success: false,
          message: 'User has already been logged out',
        });
      } else {
        const revocationDate = new Date();
        revokeToken(token, revocationDate.toString());
        return res.json({
          success: true,
          message: 'User successfully logged out',
        });
      }
    } else {
      return res.json({
        success: false,
        message: 'Authorization token is not supplied',
      });
    }
  },
};
