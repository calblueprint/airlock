require('dotenv').config();
const querystring = require('querystring');
const isEmpty = require('lodash/isEmpty');

const {
  AIRTABLE_BASE_ID,
  AIRTABLE_ENDPOINT_URL,
  AIRTABLE_USER_TABLE
} = process.env;

users = (queryParams = {}) => {
  if (!isEmpty(queryParams)) {
    const urlQuery = {
      url: `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}?${querystring.stringify(
        queryParams
      )}`
    };
    return urlQuery;
  }
  return {
    url: `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}?`
  };
};

module.exports = {
  users: users
};
