import util from 'util';
import redis from 'redis';

const { CACHE_PORT, CACHE_HOST, CACHE_PASSWORD } = process.env;
const BASE_CONVERTER = 10;

const tokenStore = redis.createClient({
  port: parseInt(CACHE_PORT, BASE_CONVERTER),
  host: CACHE_HOST,
  password: CACHE_PASSWORD,
});

const getAsync = util.promisify(tokenStore.get).bind(tokenStore);
const setAsync = util.promisify(tokenStore.set).bind(tokenStore);

export default {
  getAsync: getAsync,
  setAsync: setAsync,
};
