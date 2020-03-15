const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));
const { CACHE_PORT, CACHE_HOST, CACHE_PASSWORD } = process.env;
/* Values are hard-coded for this example, it's usually best to bring these in via file or environment variable for production */
const tokenStore = redis.createClient({
  port: CACHE_PORT, // replace with your port
  host: CACHE_HOST, // replace with your hostanme or IP address
  password: CACHE_PASSWORD, // replace with your password
  // optional, if using SSL
  // use `fs.readFile[Sync]` or another method to bring these values in
});
module.exports = tokenStore;
