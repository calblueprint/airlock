require('dotenv').config();
const zlib = require('zlib');
const httpProxy = require('http-proxy');
const cache = require('../utils/cache');

const { AIRTABLE_API_KEY, AIRTABLE_ENDPOINT_URL } = process.env;
const CONTENT_ENCODING = 'content-encoding';
const GZIP = 'gzip';

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: false,
  selfHandleResponse: true
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('authorization', `Bearer ${AIRTABLE_API_KEY}`);
});

proxy.on('proxyRes', function(proxyRes, req, res) {
  proxyRes.on('data', function(chunk) {
    if (proxyRes.headers[`${CONTENT_ENCODING}`] == `${GZIP}`) {
      zlib.gunzip(chunk, function(err, dezipped) {
        let unzipPayload = dezipped.toString();
        cache.set(req, JSON.parse(unzipPayload));
        return res.send(JSON.parse(unzipPayload));
      });
    } else {
      res.status(proxyRes.statusCode).send(JSON.parse(chunk.toString()));
    }
  });
});

module.exports = {
  web(req, res) {
    const content = cache.get(req);
    if (content) {
      return res.status(200).send(content);
    }
    proxy.web(req, res, {
      target: `${AIRTABLE_ENDPOINT_URL}`
    });
  }
};
