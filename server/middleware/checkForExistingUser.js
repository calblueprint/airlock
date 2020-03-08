require('dotenv').config();
const AirtableRoute = require('../utils/AirtableRoute');
const util = require('util');
const request = util.promisify(require('request'));

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_API_VERSION,
  AIRTABLE_USER_AGENT,
  AIRTABLE_USERNAME_COLUMN_NAME,
} = process.env;

const HEADERS = {
  authorization: 'Bearer ' + AIRTABLE_API_KEY,
  'x-api-version': AIRTABLE_API_VERSION,
  'x-airtable-application-id': AIRTABLE_BASE_ID,
  'User-Agent': AIRTABLE_USER_AGENT,
};

const REQUEST_OPTIONS = {
  json: true,
  timeout: 5000,
  headers: HEADERS,
  agentOptions: {
    rejectUnauthorized: false,
  },
};

const checkForExistingUser = async (req, res, next) => {
  if (!req.body || !req.body.username) {
    next();
  }
  const username = req.body.username;
  const queryUserUrl = AirtableRoute.users({
    filterByFormula: `${AIRTABLE_USERNAME_COLUMN_NAME}="${username}"`,
  });

  try {
    const {
      body: { records },
    } = await request({
      ...REQUEST_OPTIONS,
      ...queryUserUrl,
      method: 'GET',
    });
    req.user = records[0];
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkForExistingUser: checkForExistingUser,
};
