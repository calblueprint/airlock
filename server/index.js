require('dotenv').config();
const request = require('request');
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const isEmpty = require('lodash/isEmpty');
const objectToQueryParamString = require('./lib/object_to_query_param_string');
const QUERY = require('./lib/query');
const JWT = require('./lib/jwt');

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

app.all('/v0*', JWT.verifyToken, (req, res) => {
  proxy.web(req, res, {
    target: `${AIRTABLE_ENDPOINT_URL}`
  });
});

app.post('/register', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const urlCreate = QUERY.CREATE_URL_STRING();
  const queryUserUrl = QUERY.CREATE_URL_STRING(
    objectToQueryParamString({
      fields: ['username'],
      filterByFormula: `username="${username}"`
    })
  );

  var requestPayload = {
    body: {
      fields: {
        username: `${username}`,
        password: `${password}`
      }
    }
  };

  request(
    { ...REQUEST_OPTIONS, ...queryUserUrl, method: 'GET' },
    async function(error, resp, body) {
      const [user] = body.records;
      if (error) {
        return res.status(400).send(error);
      }
      if (!isEmpty(user)) {
        const payload = { success: false, message: 'user exists' };
        return res.status(422).send(payload);
      } else {
        const hash = await bcrypt.hash(
          req.body.password,
          parseInt(SALT_ROUNDS, 10)
        );
        if (!JSON.parse(DISABLE_HASH_PASSWORD)) {
          requestPayload.body.fields.password = hash;
        }
        request(
          {
            ...REQUEST_OPTIONS,
            ...urlCreate,
            ...requestPayload,
            method: 'POST'
          },
          function(error, resp, body) {
            const user = body;
            if (error) {
              return res.send(error);
            }
            if (!isEmpty(user)) {
              const token = JWT.createToken(user);
              const payload = { success: true, token: token, user: user };
              return res.status(200).json(payload);
            } else {
              const payload = { success: false };
              return res.status(422).send(payload);
            }
          }
        );
      }
    }
  );
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const queryParams = !JSON.parse(DISABLE_HASH_PASSWORD)
    ? {
        filterByFormula: `username="${username}"`
      }
    : { filterByFormula: `AND(username="${username}",password="${password}")` };

  const url = QUERY.CREATE_URL_STRING(objectToQueryParamString(queryParams));

  request({ ...REQUEST_OPTIONS, ...url, method: 'GET' }, async function(
    error,
    resp,
    body
  ) {
    const [user] = body.records;
    if (error) {
      return res.send(error);
    }
    if (!isEmpty(user)) {
      if (!JSON.parse(DISABLE_HASH_PASSWORD)) {
        const match = await bcrypt.compare(
          req.body.password,
          user.fields.password
        );
        if (match) {
          const token = JWT.createToken(user);
          const payload = {
            success: true,
            token: token,
            user: user
          };
          return res.status(200).json(payload);
        } else {
          const payload = { success: false, error: 'Invalid login' };
          return res.status(422).send(payload);
        }
      } else {
        const token = JWT.createToken(user);
        const payload = { success: true, token: token, user: user };
        return res.status(200).json(payload);
      }
    } else {
      const payload = { success: false, error: 'user not found' };
      return res.status(422).send(payload);
    }
  });
});

app.use((err, req, res, next) => {
  console.log(err);
  return res.status(422).send({ error: err.message });
});

const server = http.createServer(app);
server.listen(4000);
