const { tokenStore } = require('../config/tokenStore');

const isTokenRevoked = token => {
  value = tokenStore.get(token);
  return value;
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
