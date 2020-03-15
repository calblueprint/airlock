const { tokenStore } = require('../config/tokenStore');

//this should be a utility function
const revokeToken = (token, revocation_date) => {
  tokenStore.set(token, revocation_date);
};

const clearRevokedTokens = () => {
  tokenStore.flushAll();
};

module.exports = {
  revokeToken: revokeToken,
  clearRevokedTokens: clearRevokedTokens,
};
