import fs from 'fs';
import path from 'path';

export default {
  resolversDir: (resolversDir: string) => {
    const stats: fs.Stats = fs.statSync(resolversDir);
    if (!stats.isDirectory) {
      throw new Error(`resolversDir '${resolversDir}' is not a directory`);
    }
  },
  configDir: (configDir: string) => {
    const stats: fs.Stats = fs.statSync(configDir);
    if (!stats.isDirectory) {
      throw new Error(`configDir '${configDir}' is not a directory`);
    }
    if (
      !fs.existsSync(path.join(configDir, 'jwt.key')) ||
      !fs.existsSync(path.join(configDir, 'jwt.key.pub'))
    ) {
      throw new Error(
        `Could not find jwt.key or jwt.key.pub in your configDir, '${configDir}'`,
      );
    }
  },
  airtableApiKey: (apiKey: string) => {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('No Airtable API key was specified');
    }
    if (!apiKey.startsWith('key')) {
      throw new Error(
        'Malformatted Airtable API key. It should begin with `key`.',
      );
    }
  },
  airtableBaseId: (baseId: string) => {
    if (!baseId || !baseId.trim()) {
      throw new Error('No Airtable base ID was specified');
    }
    if (!baseId.startsWith('app')) {
      throw new Error(
        'Malformatted Airtable base ID. It should begin with `app`.',
      );
    }
  },
  airtableUserTableName: (tableName: string) => {
    if (!tableName || !tableName.trim()) {
      throw new Error('No Airtable table name for your users was specified');
    }
  },
  airtableUsernameColumn: (columnName: string) => {
    if (!columnName || !columnName.trim()) {
      throw new Error('No Airtable username column name was specified');
    }
  },
  airtablePasswordColumn: (columnName: string) => {
    if (!columnName || !columnName.trim()) {
      throw new Error('No Airtable password column name was specified');
    }
  },
};
