require('dotenv').config();
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const AuthController = require('./controllers/authController');
const ProxyController = require('./controllers/proxyController');
const JWT = require('./config/jwt');
const { checkForExistingUser } = require('./middleware/checkForExistingUser');
const port = process.env.PORT || 4000;

const app = express();

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
