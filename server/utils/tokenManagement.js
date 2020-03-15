const tokenStore = require('../config/tokenStore');

//returns value of token on success, null on failure
const isTokenRevoked = async token => {
  const res = await tokenStore.getAsync(token);
  return res;
};

//returns string OK on success, null on fail
const revokeToken = async (token, revocationDate) => {
  const res = await tokenStore.setAsync(token, revocationDate);
  return res;
};

module.exports = {
  isTokenRevoked: isTokenRevoked,
  revokeToken: revokeToken,
};
