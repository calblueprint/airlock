import { Record } from 'airtable';
import {
  AirlockAccessResolver,
  AirlockController,
  AirlockOptions,
} from '../main';
import logger from '../utils/logger';

export enum OperationType {
  READ = 'read',
  WRITE = 'write',
}

export type Operation = { type: OperationType; tableName: string };

export default (
  opts: AirlockOptions,
): AirlockController<{
  filterRequest: { version: string; baseId: string; tableName: string };
  filterResponse: { version: string; baseId: string; tableName: string };
}> => {
  const { accessResolvers } = opts;
  const getAccessResolver = (
    operationContext: Operation,
  ): AirlockAccessResolver | undefined => {
    const { tableName, type } = operationContext;
    const accessResolver:
      | AirlockAccessResolver
      | {
          [OperationType.READ]: AirlockAccessResolver;
          [OperationType.WRITE]: AirlockAccessResolver;
        }
      | undefined = accessResolvers[tableName];
    if (typeof accessResolver === 'object') {
      return accessResolver[type];
    }
    return accessResolver;
  };

  const runAccessResolver = async (
    accessResolver: AirlockAccessResolver,
    payload: Record<any> | { records: Record<any>[] },
    authenticatedUser: Record<any>,
    operationContext: Operation,
  ): Promise<Record<any> | { records: Record<any>[] }> => {
    const hasMultipleRecords = 'records' in payload;
    if (!('records' in payload)) {
      payload = { records: [payload] };
    }
    const filteredAndTransformedRecords: (Record<any> | null)[] = await Promise.all(
      payload.records.map((record: Record<any>) => {
        return new Promise<Record<any> | null>((resolve) => {
          let accessResolverResult = accessResolver(record, authenticatedUser);
          if (!(accessResolverResult instanceof Promise)) {
            accessResolverResult = Promise.resolve(accessResolverResult);
          }
          accessResolverResult
            .then((result: boolean | Record<object>) => {
              if (typeof result === 'boolean') {
                if (result) {
                  resolve(record);
                } else {
                  logger.debug(
                    `Access resolver for ${
                      operationContext.tableName
                    } prevented a ${
                      operationContext.type
                    } for record: ${JSON.stringify(record)}`,
                  );
                  resolve(null);
                }
              } else {
                logger.debug(
                  `Access resolver for ${
                    operationContext.tableName
                  } transformed a record from ${JSON.stringify(
                    record,
                  )} to [${typeof result}: ${JSON.stringify(result)}]`,
                );
                resolve(result);
              }
            })
            .catch((err: any) => {
              logger.warn(
                `An error was thrown: ${err} running access resolver for ${JSON.stringify(
                  record,
                )} with authenticated user ${JSON.stringify(
                  authenticatedUser,
                )}. Denying access by default.`,
              );
              resolve(null);
            });
        });
      }),
    );
    payload = {
      records: filteredAndTransformedRecords.filter(
        (record: Record<any> | null) =>
          record !== null && typeof record === 'object' && record.fields,
      ),
    };

    return hasMultipleRecords ? payload : payload.records[0];
  };

  return {
    async filterRequest(req, _res, next) {
      const operation: Operation = {
        type: req.method === 'GET' ? OperationType.READ : OperationType.WRITE,
        tableName: req.params.tableName,
      };
      const accessResolver:
        | AirlockAccessResolver
        | undefined = getAccessResolver(operation);

      if (!accessResolver) {
        logger.warn(
          `No access resolver defined for table: ${req.params.tableName}. Permitting request by default.`,
        );
        next();
        return;
      }

      if (operation.type === OperationType.WRITE && req.body) {
        const payload: Record<any> | { records: Record<any>[] } = req.body;
        req.body = await runAccessResolver(
          accessResolver,
          payload,
          req.user,
          operation,
        );
      }
      next();
    },

    async filterResponse(req, res) {
      const operation: Operation = {
        type: OperationType.READ,
        tableName: req.params.tableName,
      };
      const accessResolver:
        | AirlockAccessResolver
        | undefined = getAccessResolver(operation);

      // TODO: Create config flag for default behavior if accessResolver undefined
      if (!accessResolver) {
        logger.warn(
          `No access resolver defined for table: ${req.params.tableName}. Permitting request by default.`,
        );
        res.send(req.context);
        return;
      }

      const response = await runAccessResolver(
        accessResolver,
        req.context,
        req.user,
        operation,
      );
      res.send(response);
    },
  };
};
