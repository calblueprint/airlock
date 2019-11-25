require('dotenv').config();
const zlib = require('zlib');
const httpProxy = require('http-proxy');
const cache = require('../utils/cache');

const { AIRTABLE_API_KEY, AIRTABLE_ENDPOINT_URL } = process.env;
const CONTENT_ENCODING = 'content-encoding';
const GZIP = 'gzip';
const DEFLATE = 'deflate';

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: false,
  selfHandleResponse: true
});

async function handlePayload(buffer, encoding) {
  return new Promise((resolve, reject) => {
    if (encoding === GZIP) {
      zlib.gunzip(buffer, function(err, decoded) {
        if (err) return reject(err);
        resolve(JSON.parse(decoded.toString()));
      });
    } else if (encoding === DEFLATE) {
      zlib.inflate(buffer, function(err, decoded) {
        if (err) return reject(err);
        resolve(JSON.parse(decoded.toString()));
      });
    } else {
      resolve(JSON.parse(buffer.toString()));
    }
  });
}

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('authorization', `Bearer ${AIRTABLE_API_KEY}`);
});
proxy.on('proxyRes', function(proxyRes, req, res) {
  var body = [];
  proxyRes.on('data', function(chunk) {
    body.push(chunk);
  });
  proxyRes.on('end', async function() {
    const buffer = Buffer.concat(body);
    const proxyPayload = await handlePayload(
      buffer,
      proxyRes.headers[`${CONTENT_ENCODING}`]
    );
    if (req.method === 'GET') {
      cache.set(req, proxyPayload);
    }
    res.status(proxyRes.statusCode).send(proxyPayload);
    res.end();
  });
});

module.exports = {
  web(req, res) {
    if (req.method === 'GET') {
      const content = cache.get(req);
      if (content) {
        return res.status(200).send(content);
      }
      proxy.web(req, res, {
        target: `${AIRTABLE_ENDPOINT_URL}`
      });
    } else {
      cache.clear(req);
      proxy.web(req, res, {
        target: `${AIRTABLE_ENDPOINT_URL}`
      });
    }
  }
};
