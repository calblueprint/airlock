const { tokenStore } = require('../config/tokenStore');

//this should be middleware
const isTokenRevoked = token => {
  tokenIsPresent = true;
  value = myCache.get(token);
  if (value == undefined) {
    tokenIsPresent = false;
  }
  return tokenIsPresent;
};

//this should be a utility function
const revokeToken = (token, revocation_date) => {
  tokenStore.set(token, revocation_date);
};

const clearRevokedTokens = () => {
  tokenStore.flushAll();
};

module.exports = {
  isTokenRevoked: isTokenRevoked,
  revokeToken: revokeToken,
  clearRevokedTokens: clearRevokedTokens,
};
