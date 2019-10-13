require('dotenv').config();
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

const proxy = httpProxy.createProxyServer({changeOrigin: true, ignorePath: true});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
    proxyReq.setHeader('authorization', `Bearer ${process.env.AIRTABLE_API_KEY}`);
  });

app.use(bodyParser.json())

app.get('/', (req, res) =>{
    //validate Token
    //proxy the request
    proxy.web(req, res, {
        target: `${process.env.AIRTABLE_ENDPOINT_URL}`
      });
})

app.post('/register', (req, res) =>{
    //hash the password
    //get from query paramters
    proxy.web(req, res, {
        target: `${process.env.AIRTABLE_ENDPOINT_URL}`
      });
})

app.post('/login', (req, res) =>{
    proxy.web(req, res, {
        target: `${process.env.AIRTABLE_ENDPOINT_URL}`
      });
})

app.use((err, req, res, next) => {
    console.log(err);
    res.status(422).send({ error: err.message });
  });

const server = http.createServer(app);
server.listen(4000);