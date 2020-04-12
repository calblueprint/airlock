import tokenStore from '../lib/tokenStore';

/*
 * Checks if token is present in the tokenStore,
 * returns the value of the token, or nil when token does not exist.
 * token: string
 * value: string | null
 */
const isTokenRevoked = async (token) => {
  const value = await tokenStore.getAsync(token);
  return value;
};

/*
 * Adds token to tokenStore, along with the date the token was revoked
 * returns a reply of "+OK\r\n" on sucess or null "$-1\r\n" on failure
 * token: string
 * response: string | null
 */
const revokeToken = async (token, revocationDate) => {
  const response = await tokenStore.setAsync(token, revocationDate);
  return response;
};

export default {
  isTokenRevoked: isTokenRevoked,
  revokeToken: revokeToken,
};
