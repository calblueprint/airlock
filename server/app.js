require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');

const AuthController = require('./controllers/authController');
const ProxyController = require('./controllers/proxyController');
const JWT = require('./config/jwt');
const { checkForExistingUser } = require('./middleware/checkForExistingUser');
const port = process.env.PORT || 4000;

const CONFIG_ROOT = path.join(__dirname, 'config');
if (
  !fs.existsSync(path.join(CONFIG_ROOT, 'priv.pem')) ||
  !fs.existsSync(path.join(CONFIG_ROOT, 'pub.pem'))
) {
  console.error(
    `You must generate a public and private key in ${CONFIG_ROOT} to run Airlock!`
  );
  process.exit(1);
}

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'x-airtable-user-agent',
      'x-airtable-application-id',
      'x-api-version',
      'authorization',
      'token'
    ].join(', ')
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json());

app.post(
  '/:version/:base/__DANGEROUSLY__USE__TABLE__TO__LET__USERS__REGISTER',
  checkForExistingUser,
  AuthController.register
);

app.post(
  '/:version/:base/__DANGEROUSLY__USE__TABLE__TO__LET__USERS__LOGIN',
  checkForExistingUser,
  AuthController.login
);

app.all(
  '/:version/:baseId/:tableIdOrName*',
  JWT.verifyToken,
  ProxyController.web
);

app.use((err, req, res, next) => {
  console.log(err);
  res.status(422).send({ error: err.message });
});

const server = http.createServer(app);
server.listen(port);
