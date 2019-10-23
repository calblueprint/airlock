require('dotenv').config();
const isEmpty = require('lodash/isEmpty');

const {
  AIRTABLE_BASE_ID,
  AIRTABLE_ENDPOINT_URL,
  AIRTABLE_USER_TABLE
} = process.env;

const CREATE_URL_STRING = (queryParams = {}) => {
  if (!isEmpty(queryParams)) {
    const urlQuery = {
      url: `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}?${queryParams}`
    };
    return urlQuery;
  }
  return {
    url: `${AIRTABLE_ENDPOINT_URL}/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_USER_TABLE}?`
  };
};

module.exports = {
  CREATE_URL_STRING: CREATE_URL_STRING
};
