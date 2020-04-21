import { Record } from 'airtable';
import _request, { CoreOptions } from 'request';
import querystring from 'querystring';
import util from 'util';

import { AirlockOptions } from '../main';
const request = util.promisify(_request);

type AirtableOptions = Pick<
  AirlockOptions,
  'airtableBaseId' | 'airtableUserTableName'
>;

export const requestOptions = (options: AirlockOptions): CoreOptions => ({
  json: true,
  timeout: 5000,
  headers: {
    authorization: `Bearer ${options.airtableApiKey}`,
    'x-api-version': '0.1.0',
    'x-airtable-application-id': options.airtableBaseId,
    'User-Agent': 'Airtable.js/0.7.1',
  },
  agentOptions: {
    rejectUnauthorized: false,
  },
});

export const AIRTABLE_API_BASE_URL = 'https://api.airtable.com/';
export const routes = {
  users: (
    { airtableBaseId, airtableUserTableName }: AirtableOptions,
    queryParams = {},
  ): string =>
    `${AIRTABLE_API_BASE_URL}v0/${airtableBaseId}/${airtableUserTableName}?${querystring.stringify(
      queryParams,
    )}`,
};

export const fetchRecordsByIds = async (
  ids: string[],
  tableName: string,
  options: AirlockOptions,
): Promise<Record<any>[]> => {
  const {
    body: { records, error },
    statusCode,
  } = await request({
    url: `${AIRTABLE_API_BASE_URL}v0/${options.airtableBaseId}/${tableName}`,
    qs: {
      filterByFormula: `OR(${ids
        .map((id: string) => `RECORD_ID() = "${id}"`)
        .join(', ')})`,
    },
    ...requestOptions(options),
  });
  if (statusCode !== 200 || error) {
    throw new Error(JSON.stringify(error));
  }
  return records;
};
