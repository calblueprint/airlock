import { AirlockOptions } from '../main';
const querystring = require('querystring');

type AirtableOptions = Pick<
  AirlockOptions,
  'airtableBaseId' | 'airtableUserTableName'
>;
export default {
  users: (
    { airtableBaseId, airtableUserTableName }: AirtableOptions,
    queryParams = {},
  ): string =>
    `https://api.airtable.com/v0/${airtableBaseId}/${airtableUserTableName}?${querystring.stringify(
      queryParams,
    )}`,
};
