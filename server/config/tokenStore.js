const { promisify } = require('util');
const redis = require('redis');
const { CACHE_PORT, CACHE_HOST, CACHE_PASSWORD } = process.env;

const tokenStore = redis.createClient({
  port: CACHE_PORT,
  host: CACHE_HOST,
  password: CACHE_PASSWORD,
});

const getAsync = promisify(tokenStore.get).bind(tokenStore);
const setAsync = promisify(tokenStore.set).bind(tokenStore);

module.exports = {
  getAsync: getAsync,
  setAsync: setAsync,
};
