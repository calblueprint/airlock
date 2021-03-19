import { Record } from 'airtable';
import fromEntries from 'fromentries';
import { AirlockAccessResolver } from '../main';

export const restrictColumns = (
  accessResolver: AirlockAccessResolver,
  columnsToRestrict: string[],
): AirlockAccessResolver => {
  return async (record: Record<object>, user: Record<object>) => {
    const result = await accessResolver(record, user);
    if (typeof result === 'object') {
      record = result;
    }
    if (!result) {
      return false;
    }
    return {
      ...record,
      fields: fromEntries(
        Object.keys(record.fields)
          .filter((key: string) => !columnsToRestrict.includes(key))
          .map((key: string) => [key, record.fields[key]]),
      ),
    };
  };
};
