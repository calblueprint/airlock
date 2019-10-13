require('dotenv').config();
const request = require('request');
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

const proxy = httpProxy.createProxyServer({changeOrigin: true, ignorePath: false});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
    proxyReq.setHeader('authorization', `Bearer ${process.env.AIRTABLE_API_KEY}`);
  });

app.use(bodyParser.json())

/**
 * TODO: Validate AirLock token issue
 * TODO: Successfully issue request
 *
 * function takes in
 * This function imagines the client sending a request to: https://airlock-test.now.sh (custom endpoint that developer has set)
 * Their url will look just like if they were sending their request to the actual airtable api endpoint
 * https://airlock-test.now.sh/v0/baseID/tableName
 *
 * This function will take the airlock token from the headers request, verify it and proxy the request
 *
 * it will preserve the query path (/v0/baseId/tableName) but swaap out the target
 *
 */
app.get('/v0*', (req, res) =>{
    //extract airlock token
    //verify airlock token
    //if valid airlock token then proxy request, if not valid send error (client should sign out client)
    proxy.web(req, res, {
        target: `${process.env.AIRTABLE_ENDPOINT_URL}`
      });
})

/**
 * TODO: Lookup username + password if they exist -- if they exist -- return messaage
 * TODO: If user doesn't exist -- create user
 * TODO: Issue AirLock Token if user exists
 */
app.post('/register', (req, res) =>{
})

/** TODO:
 * TODO: HASH PASSWORD
 * TODO: RETURN AIRLOCK token
 * TODO: return error message if user does not exist
 */
app.post('/login', (req, res) =>{

    const username = req.body.username;
    const password = req.body.password;

    const url =`${process.env.AIRTABLE_ENDPOINT_URL}/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USER_TABLE}?fields%5B%5D=username&filterByFormula=AND(username%3D%22${username}%22%2Cpassword%3D%22${password}%22)`;
    const headers = {
        'authorization': 'Bearer ' + process.env.AIRTABLE_API_KEY,
        'x-api-version': process.env.AIRTABLE_API_VERSION,
        'x-airtable-application-id': process.env.AIRTABLE_BASE_ID,
        'User-Agent': process.env.AIRTABLE_USER_AGENT
    };
    var options = {
        method:'GET',
        url: url,
        json: true,
        timeout:5000,
        headers: headers,
        agentOptions: {
            rejectUnauthorized: false
        },
    };
    request(options, function(error, resp, body) {
        if (error) {
            res.send(error)
        }
        if(body.records.length > 0){
            const payload = {"success": true,"token" : "1234", "user": body.records[0]}
            res.send(payload)
        } else {
            const payload = {"success": false }
            res.send(payload)
        }
    });
})

app.use((err, req, res, next) => {
    console.log(err);
    res.status(422).send({ error: err.message });
  });

const server = http.createServer(app);
server.listen(4000);