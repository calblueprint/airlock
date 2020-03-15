require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');

const AuthController = require('./controllers/authController');
const ProxyController = require('./controllers/proxyController');
const JWT = require('./middleware/verifyToken');
const { checkForExistingUser } = require('./middleware/checkForExistingUser');
const { isTokenRevoked } = require('./middleware/isTokenRevoked');
const port = process.env.PORT || 4000;

const { PUBLIC_KEY, PRIVATE_KEY } = process.env;

const CONFIG_ROOT = path.join(__dirname, 'config');

if (PUBLIC_KEY) {
  fs.writeFileSync(path.join(CONFIG_ROOT, 'pub.pem'));
}
if (PRIVATE_KEY) {
  fs.writeFileSync(path.join(CONFIG_ROOT, 'priv.pem'));
}
if (
  !fs.existsSync(path.join(CONFIG_ROOT, 'priv.pem')) ||
  !fs.existsSync(path.join(CONFIG_ROOT, 'pub.pem'))
) {
  console.error(
    `You must generate a public and private key in ${CONFIG_ROOT} to run Airlock!`,
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
      'token',
    ].join(', '),
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.post(
  '/:version/:base/__DANGEROUSLY__USE__TABLE__TO__LET__USERS__REGISTER',
  bodyParser.json(),
  checkForExistingUser,
  AuthController.register,
);

app.post(
  '/:version/:base/__DANGEROUSLY__USE__TABLE__TO__LET__USERS__LOGIN',
  bodyParser.json(),
  checkForExistingUser,
  AuthController.login,
);

app.post(
  '/:version/:base/__DANGEROUSLY__USE__TABLE__TO__LET__USERS__LOGOUT',
  bodyParser.json(),
  checkForExistingUser,
  AuthController.logout,
);

app.all(
  '/:version/:baseId/:tableIdOrName*',
  JWT.verifyToken,
  isTokenRevoked,
  ProxyController.web,
);

app.use((err, req, res, next) => {
  console.log(err);
  res.status(422).send({ error: err.message });
});

const server = http.createServer(app);
server.listen(port);
