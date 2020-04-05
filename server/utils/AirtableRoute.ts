import { AirlockOptions } from '../main';
const querystring = require('querystring');

type AirtableOptions = Pick<
  AirlockOptions,
  'airtableBaseId' | 'airtableUserTableName'
>;

export const AIRTABLE_API_BASE_URL = 'https://api.airtable.com/';

export default {
  users: (
    { airtableBaseId, airtableUserTableName }: AirtableOptions,
    queryParams = {},
  ): string =>
    `${AIRTABLE_API_BASE_URL}v0/${airtableBaseId}/${airtableUserTableName}?${querystring.stringify(
      queryParams,
    )}`,
};
