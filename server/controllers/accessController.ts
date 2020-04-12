import { Record } from 'airtable';
import {
  AirlockAccessResolver,
  AirlockController,
  AirlockOptions,
} from '../main';
import logger from '../utils/logger';

export default (
  opts: AirlockOptions,
): AirlockController<{
  filterResponse: { version: string; baseId: string; tableName: string };
}> => {
  const { accessResolvers } = opts;
  return {
    async filterResponse(req, res) {
      const accessResolver: AirlockAccessResolver | undefined =
        accessResolvers[req.params.tableName];

      // TODO: Create config flag for default behavior if accessResolver undefined
      if (!accessResolver) {
        logger.warn(
          `No access resolver defined for table: ${req.params.tableName}. Permitting request by default.`,
        );
        res.send(req.context);
        return;
      }

      const multipleRecordResponse = 'records' in req.context;
      if (!('records' in req.context)) {
        req.context = { records: [req.context] };
      }
      const hasAccess: boolean[] = await Promise.all(
        req.context.records.map((record: Record<any>) =>
          accessResolver(record, req.user),
        ),
      );
      req.context = {
        records: req.context.records.filter(
          (record: Record<any>, index: number) => {
            !hasAccess[index] &&
              logger.debug(
                `Access resolver for ${
                  req.params.tableName
                } denied access to record: ${JSON.stringify(record)}`,
              );
            return hasAccess[index];
          },
        ),
      };

      res.send(multipleRecordResponse ? req.context : req.context.records[0]);
    },
  };
};
