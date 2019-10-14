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
  HASH_PASSWORD,
  SALT_ROUNDS
} = process.env;

const HEADERS = {
  authorization: 'Bearer ' + AIRTABLE_API_KEY,
  'x-api-version': AIRTABLE_API_VERSION,
  'x-airtable-application-id': AIRTABLE_BASE_ID,
  'User-Agent': AIRTABLE_USER_AGENT
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
app.use('/v0*', JWT.verifyToken);

app.all('/v0*', (req, res) => {
  proxy.web(req, res, {
    target: `${AIRTABLE_ENDPOINT_URL}`
  });
});

app.post('/register', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const url = `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}?fields%5B%5D=username&filterByFormula=username%3D%22${username}%22`;
  const options = {
    method: 'GET',
    url: url,
    json: true,
    timeout: 5000,
    headers: HEADERS,
    agentOptions: {
      rejectUnauthorized: false
    }
  };
  var optionsCreate = {
    method: 'POST',
    url: USERNAME_CREATE_URL,
    json: true,
    timeout: 5000,
    headers: HEADERS,
    agentOptions: {
      rejectUnauthorized: false
    },
    body: {
      fields: {
        username: `${username}`,
        password: `${password}`
      }
    }
  };
  request(options, async function(error, resp, body) {
    if (error) {
      res.send(error);
    }
    if (body.records.length > 0) {
      const payload = { success: false, message: 'user exists' };
      res.status(422).send(payload);
      res.send(payload);
    } else {
      if (JSON.parse(HASH_PASSWORD) === true) {
        bcrypt.hash(
          req.body.password.trim(),
          parseInt(SALT_ROUNDS, 10),
          (err, hash) => {
            optionsCreate.body.fields.password = hash;
            request(optionsCreate, function(error, resp, body) {
              const user = body;
              if (error) {
                res.send(error);
              }
              if (user) {
                delete user.fields.password;
                const token = JWT.createToken(user);
                const payload = { success: true, token: token, user: user };
                res.status(200).json(payload);
              } else {
                const payload = { success: false };
                res.status(422).send(payload);
              }
            });
          }
        );
      } else {
        request(optionsCreate, function(error, resp, body) {
          if (error) {
            res.send(error);
          }
          if (body) {
            const token = JWT.createToken(body);
            const payload = { success: true, token: token, user: body };
            res.status(200).json(payload);
          } else {
            const payload = { success: false };
            res.status(422).send(payload);
          }
        });
      }
    }
  });
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const url = `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}/?${querystring.stringify(
    {
      filterByFormula: `AND(username="${username}",password="${password}")`
    }
  )}`;
  const urlHash = `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}/?${querystring.stringify(
    {
      filterByFormula: `username="${username}"`
    }
  )}`;

  var options = {
    method: 'GET',
    url: url,
    json: true,
    timeout: 5000,
    headers: HEADERS,
    agentOptions: {
      rejectUnauthorized: false
    }
  };

  if (JSON.parse(HASH_PASSWORD) === true) {
    options.url = urlHash;
  }

  request(options, function(error, resp, body) {
    if (error) {
      res.send(error);
    }
    if (body.records.length > 0) {
      const [user] = body.records;
      if (JSON.parse(HASH_PASSWORD) === true) {
        bcrypt
          .compare(req.body.password.trim(), user.fields.password)
          .then(result => {
            if (result) {
              delete user.fields.password;
              const token = JWT.createToken(user);
              const payload = {
                success: true,
                token: token,
                user: user
              };
              res.status(200).json(payload);
            } else {
              const payload = { success: false, error: 'Invalid login' };
              res.status(422).send(payload);
            }
          });
      } else {
        const [user] = body.records;
        delete user.fields.password;
        const token = JWT.createToken(user);
        const payload = { success: true, token: token, user: user };
        res.status(200).json(payload);
      }
    } else {
      const payload = { success: false, error: 'user not found' };
      res.status(422).send(payload);
    }
  });
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(422).send({ error: err.message });
});

const server = http.createServer(app);
server.listen(4000);
