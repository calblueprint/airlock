require('dotenv').config();
const httpProxy = require('http-proxy');

const { AIRTABLE_API_KEY, AIRTABLE_ENDPOINT_URL } = process.env;

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: false
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('authorization', `Bearer ${AIRTABLE_API_KEY}`);
});

module.exports = {
  web(req, res) {
    proxy.web(req, res, {
      target: `${AIRTABLE_ENDPOINT_URL}`
    });
  }
};
