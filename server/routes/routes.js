const AuthController = require('../controllers/auth_controller');
const ProxyController = require('../controllers/proxy_controller');
const JWT = require('../config/jwt');
const { checkForExistingUser } = require('../middleware/checkForExistingUser');

module.exports = app => {
  //authentication
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
  //proxy
  app.all('/v0*', JWT.verifyToken, ProxyController.web);
};
