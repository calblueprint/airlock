require('dotenv').config();
const request = require('request');
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const querystring = require('querystring');
const JWT = require('./jwt');

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_ENDPOINT_URL,
  AIRTABLE_API_VERSION,
  AIRTABLE_USER_AGENT,
  AIRTABLE_USER_TABLE,
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

const USERNAME_CREATE_URL = `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}?`;

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

app.post('/register', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const url = {
    url: `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}?fields%5B%5D=username&${querystring.stringify(
      {
        filterByFormula: `username="${username}"`
      }
    )}`
  };
  const urlCreate = {
    url: USERNAME_CREATE_URL
  };
  var requestPayload = {
    body: {
      fields: {
        username: `${username}`,
        password: `${password}`
      }
    }
  };

  request({ ...REQUEST_OPTIONS, ...url, method: 'GET' }, async function(
    error,
    resp,
    body
  ) {
    const [user] = body.records;
    if (error) {
      return res.status(400).send(error);
    }
    if (user) {
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
        { ...REQUEST_OPTIONS, ...urlCreate, ...requestPayload, method: 'POST' },
        function(error, resp, body) {
          const user = body;
          if (error) {
            return res.send(error);
          }
          if (user) {
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
  });
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const url = {
    url: `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}/?${querystring.stringify(
      {
        filterByFormula: `AND(username="${username}",password="${password}")`
      }
    )}`
  };
  const urlHash = {
    url: `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}/?${querystring.stringify(
      {
        filterByFormula: `username="${username}"`
      }
    )}`
  };

  const requestURL = !JSON.parse(DISABLE_HASH_PASSWORD) ? urlHash : url;

  request({ ...REQUEST_OPTIONS, ...requestURL, method: 'GET' }, async function(
    error,
    resp,
    body
  ) {
    const [user] = body.records;
    if (error) {
      return res.send(error);
    }
    if (user) {
      const [user] = body.records;
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
