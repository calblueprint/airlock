import { IncomingMessage } from 'http';
import NodeCache from 'node-cache';

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
  const urlParse = /https?:\/\/.*\/(v[^/]*)\/(app[^/]+)\/([^?/]+)[\/.+]*/;
  const [, version, baseId, tableName] = req.url.match(urlParse);
  const cacheKey = [version, baseId, tableName].join('/');
  return cacheKey;
};

const get = (req: IncomingMessage): CacheEntry => {
  const url = createCacheKey(req);
  return {
    contentType: cache.get<string>(`${url}/Content-Type`),
    data: cache.get<string>(url),
  };
};

const set = (req: IncomingMessage, data: string): void => {
  const url = createCacheKey(req);
  cache.set(url, data);
  cache.set(`${url}/Content-Type`, req.headers['content-type']);
};

const clear = (req: IncomingMessage): void => {
  let urlKey = createClearKey(req);
  cache.del(cache.keys().filter(k => k.includes(urlKey)));
};

export default {
  get,
  set,
  clear,
};
