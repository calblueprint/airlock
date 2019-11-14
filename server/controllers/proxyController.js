require('dotenv').config();
zlib = require('zlib');
const httpProxy = require('http-proxy');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1 * 60 });
const Bottleneck = require('bottleneck');
const rateLimiter = new Bottleneck({
  minTime: 1050 / 5,
});

parseUrl = req => {
  return req.originalUrl;
};

const { AIRTABLE_API_KEY, AIRTABLE_ENDPOINT_URL } = process.env;

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: false,
  selfHandleResponse: true,
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('authorization', `Bearer ${AIRTABLE_API_KEY}`);
});

proxy.on('proxyRes', function(proxyRes, req, res) {
  var dizzy;
  proxyRes.on('data', function(chunk) {
    if (proxyRes.headers['content-encoding'] == 'gzip') {
      zlib.gunzip(chunk, function(err, dezipped) {
        dizzy = dezipped.toString();
        const url = parseUrl(req);
        cache.set(url, JSON.parse(dizzy));
        res.send(JSON.parse(dizzy));
      });
    } else {
      console.log('non gzip airtable data?');
    }
  });
});

module.exports = {
  web(req, res) {
    const url = parseUrl(req);
    const content = cache.get(url);
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
