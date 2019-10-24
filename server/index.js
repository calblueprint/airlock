require('dotenv').config();
const util = require('util');
const request = util.promisify(require('request'));
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const isEmpty = require('lodash/isEmpty');
const AirtableRoute = require('./utils/AirtableRoute');
const JWT = require('./config/jwt');
const { checkForExistingUser } = require('./middleware/checkForExistingUser');

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_ENDPOINT_URL,
  AIRTABLE_API_VERSION,
  AIRTABLE_USER_AGENT,
  DISABLE_HASH_PASSWORD,
  SALT_ROUNDS
} = process.env;

const HEADERS = {
  authorization: 'Bearer ' + AIRTABLE_API_KEY,
  'x-api-version': AIRTABLE_API_VERSION,
  'x-airtable-application-id': AIRTABLE_BASE_ID,
  'User-Agent': AIRTABLE_USER_AGENT
};

const REQUEST_OPTIONS = {
  json: true,
  timeout: 5000,
  headers: HEADERS,
  agentOptions: {
    rejectUnauthorized: false
  }
};

const app = express();

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: false
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('authorization', `Bearer ${AIRTABLE_API_KEY}`);
});

app.use(bodyParser.json());

app.post(
  '/:version/:base/__I__WROTE__90__PERCENT__OF__THE__CODE__REGISTER',
  checkForExistingUser,
  async (req, res, next) => {
    if (!isEmpty(req.user)) {
      const payload = { success: false, message: 'user exists' };
      return res.status(422).send(payload);
    }

    const urlCreate = AirtableRoute.users();
    const hash = await bcrypt.hash(
      req.body.password,
      parseInt(SALT_ROUNDS, 10)
    );
    let newUser;
    try {
      ({ body: newUser } = await request({
        ...REQUEST_OPTIONS,
        ...urlCreate,
        ...{
          body: {
            fields: {
              username: `${req.body.username}`,
              password: `${
                !JSON.parse(DISABLE_HASH_PASSWORD) ? hash : password
              }`
            }
          }
        },
        method: 'POST'
      }));
    } catch (err) {
      next(err);
    }

    if (!isEmpty(newUser)) {
      const token = JWT.createToken(newUser);
      const payload = { success: true, token: token, user: newUser };
      return res.status(200).json(payload);
    }
    const payload = { success: false };
    return res.status(422).send(payload);
  }
);

app.post(
  '/:version/:base/__YOU__FELL__ASLEEP__LOGIN',
  checkForExistingUser,
  async (req, res) => {
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
          user: req.user
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
        user: req.user
      };
      return res.status(200).json(payload);
    }
    const payload = { success: false, error: 'Invalid login' };
    return res.status(422).send(payload);
  }
);

app.all('/v0*', JWT.verifyToken, (req, res) => {
  proxy.web(req, res, {
    target: `${AIRTABLE_ENDPOINT_URL}`
  });
});

app.use((err, req, res, next) => {
  console.log(err);
  return res.status(422).send({ error: err.message });
});

const server = http.createServer(app);
server.listen(4000);
