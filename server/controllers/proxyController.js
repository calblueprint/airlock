require('dotenv').config();
const zlib = require('zlib');
const httpProxy = require('http-proxy');
const cache = require('../utils/cache');
const { rateLimiter } = require('../utils/rateLimit');

const { AIRTABLE_API_KEY, AIRTABLE_ENDPOINT_URL } = process.env;
const CONTENT_ENCODING = 'content-encoding';
const GZIP = 'gzip';

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: false,
  selfHandleResponse: true,
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('authorization', `Bearer ${AIRTABLE_API_KEY}`);
});

proxy.on('proxyRes', function(proxyRes, req, res) {
  let unzipPayload = null;
  proxyRes.on('data', function(chunk) {
    if (proxyRes.headers[`${CONTENT_ENCODING}`] == `${GZIP}`) {
      zlib.gunzip(chunk, function(err, dezipped) {
        unzipPayload = dezipped.toString();
        cache.set(req, JSON.parse(unzipPayload));
        return res.send(JSON.parse(unzipPayload));
      });
    } else {
      throw new Error('non gzip data returned');
    }
  });
});

module.exports = {
  web(req, res) {
    const content = cache.get(req);
    if (content) {
      return res.status(200).send(content);
    }
    rateLimiter.wrap(
      proxy.web(req, res, {
        target: `${AIRTABLE_ENDPOINT_URL}`,
      })
    );
  },
};
