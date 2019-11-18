const Bottleneck = require('bottleneck');
const rateLimiter = new Bottleneck({
  minTime: 1050 / 5,
});

module.exports = {
  rateLimiter: rateLimiter,
};
