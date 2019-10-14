require('dotenv').config();
const request = require('request');
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');
const JWT = require('./jwt');

const app = express();

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: false
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('authorization', `Bearer ${process.env.AIRTABLE_API_KEY}`);
});

app.use(bodyParser.json());

app.get('/v0*', JWT.verifyToken, (req, res) => {
  proxy.web(req, res, {
    target: `${process.env.AIRTABLE_ENDPOINT_URL}`
  });
});

app.post('/v0*', JWT.verifyToken, (req, res) => {
  proxy.web(req, res, {
    target: `${process.env.AIRTABLE_ENDPOINT_URL}`
  });
});

app.put('/v0*', JWT.verifyToken, (req, res) => {
  proxy.web(req, res, {
    target: `${process.env.AIRTABLE_ENDPOINT_URL}`
  });
});

app.delete('/v0*', JWT.verifyToken, (req, res) => {
  proxy.web(req, res, {
    target: `${process.env.AIRTABLE_ENDPOINT_URL}`
  });
});

/**
 * TODO: Option to Hash
 */
app.post('/register', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const url = `${process.env.AIRTABLE_ENDPOINT_URL}/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USER_TABLE}?fields%5B%5D=username&filterByFormula=username%3D%22${username}%22`;
  const headers = {
    authorization: 'Bearer ' + process.env.AIRTABLE_API_KEY,
    'x-api-version': process.env.AIRTABLE_API_VERSION,
    'x-airtable-application-id': process.env.AIRTABLE_BASE_ID,
    'User-Agent': process.env.AIRTABLE_USER_AGENT
  };
  const options = {
    method: 'GET',
    url: url,
    json: true,
    timeout: 5000,
    headers: headers,
    agentOptions: {
      rejectUnauthorized: false
    }
  };
  const urlCreate = `${process.env.AIRTABLE_ENDPOINT_URL}/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USER_TABLE}?`;
  const optionsCreate = {
    method: 'POST',
    url: urlCreate,
    json: true,
    timeout: 5000,
    headers: headers,
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
  });
});

//TODO: Option to Hash
app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const url = `${process.env.AIRTABLE_ENDPOINT_URL}/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USER_TABLE}?fields%5B%5D=username&filterByFormula=AND(username%3D%22${username}%22%2Cpassword%3D%22${password}%22)`;
  const headers = {
    authorization: 'Bearer ' + process.env.AIRTABLE_API_KEY,
    'x-api-version': process.env.AIRTABLE_API_VERSION,
    'x-airtable-application-id': process.env.AIRTABLE_BASE_ID,
    'User-Agent': process.env.AIRTABLE_USER_AGENT
  };
  var options = {
    method: 'GET',
    url: url,
    json: true,
    timeout: 5000,
    headers: headers,
    agentOptions: {
      rejectUnauthorized: false
    }
  };
  request(options, function(error, resp, body) {
    if (error) {
      res.send(error);
    }
    if (body.records.length > 0) {
      const token = JWT.createToken(body.records[0]);
      const payload = { success: true, token: token, user: body.records[0] };
      res.status(200).json(payload);
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
