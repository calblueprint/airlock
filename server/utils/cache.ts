import { IncomingMessage } from 'http';
import NodeCache from 'node-cache';
import logger from './logger';

const CACHE_TTL_ONE_MINUTE = 1 * 60;
const cache = new NodeCache({
  stdTTL: CACHE_TTL_ONE_MINUTE,
  forceString: true,
});

type CacheEntry = {
  contentType: string;
  data: string;
};

const createCacheKey = (req: IncomingMessage): string => {
  return req.url;
};

const createClearKey = (req: IncomingMessage): string => {
  const urlParse = /\/(v[^/]*)\/(app[^/]+)\/([^?/]+)[\/.+]*/;
  const [, version, baseId, tableName] = req.url.match(urlParse);
  const cacheKey = [version, baseId, tableName].join('/');
  return `/${cacheKey}`;
};

const get = (req: IncomingMessage): CacheEntry => {
  const url = createCacheKey(req);
  const data = cache.get<string>(url);
  const contentType = cache.get<string>(`${url}/Content-Type`);
  logger.debug(
    `Getting cache key: ${url}, retrieved ${contentType}: '${data}'`,
  );

  return {
    contentType,
    data,
  };
};

const set = (req: IncomingMessage, data: string, contentType: string): void => {
  const url = createCacheKey(req);
  cache.set(url, data);
  cache.set(`${url}/Content-Type`, contentType);

  logger.debug(`Setting cache key: ${url}, with ${contentType}: '${data}'`);
};

const clear = (req: IncomingMessage): void => {
  const urlKey = createClearKey(req);
  const removeKeys = cache.keys().filter((k) => k.includes(urlKey));
  cache.del(removeKeys);
  logger.debug(
    `Clearing cache keys: ${JSON.stringify(
      removeKeys,
    )} from clearKey: ${urlKey}`,
  );
};

export default {
  get,
  set,
  clear,
};
