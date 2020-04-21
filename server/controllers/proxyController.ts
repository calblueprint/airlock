import { Record } from 'airtable';
import { ClientRequest, IncomingMessage, ServerResponse } from 'http';
import httpProxy from 'http-proxy';
import querystring from 'querystring';
import url from 'url';
import zlib from 'zlib';

import { AirlockController, AirlockOptions } from '../main';
import { AIRTABLE_API_BASE_URL, fetchRecordsByIds } from '../utils/airtable';
import cache from '../utils/cache';
import logger from '../utils/logger';

enum Encoding {
  GZIP = 'gzip',
  DEFLATE = 'deflate',
}

export default (
  options: AirlockOptions,
): AirlockController<{
  web: {};
  hydrateRecordIds: { tableName: string };
  flattenRecordsToIds: { tableName: string };
}> => {
  const { airtableApiKey } = options;
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    ignorePath: false,
    selfHandleResponse: true,
  });

  async function handlePayload(
    buffer: Buffer,
    encoding: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (encoding === Encoding.GZIP) {
        zlib.gunzip(buffer, function (err, decoded) {
          if (err) return reject(err);
          resolve(decoded.toString());
        });
      } else if (encoding === Encoding.DEFLATE) {
        zlib.inflate(buffer, function (err, decoded) {
          if (err) return reject(err);
          resolve(decoded.toString());
        });
      } else {
        resolve(buffer.toString());
      }
    });
  }

  proxy.on('proxyReq', function (
    proxyReq: ClientRequest,
    req: IncomingMessage,
  ) {
    proxyReq.setHeader('authorization', `Bearer ${airtableApiKey}`);
    const contentType = proxyReq.getHeader('Content-Type');

    // @ts-ignore
    let bodyData = Object.keys(req.body) > 0 ? req.body : '';
    if (contentType === 'application/json') {
      bodyData = JSON.stringify(bodyData);
    }
    if (contentType === 'application/x-www-form-urlencoded') {
      bodyData = querystring.stringify(bodyData);
    }

    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  });

  proxy.on('proxyRes', function (
    proxyRes: IncomingMessage,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    var body = [];
    proxyRes.on('data', function (chunk) {
      body.push(chunk);
    });

    proxyRes.on('end', async function () {
      try {
        const buffer = Buffer.concat(body);
        const proxyPayload = await handlePayload(
          buffer,
          proxyRes.headers['content-encoding'],
        );
        if (req.method === 'GET' && proxyRes.statusCode === 200) {
          cache.set(req, proxyPayload, proxyRes.headers['content-type']);
        }

        res.setHeader('content-type', proxyRes.headers['content-type']);
        if (proxyRes.statusCode !== 200) {
          req.emit('payloadError', proxyPayload);
        } else {
          req.emit('payloadReady', proxyPayload);
        }
      } catch (err) {
        logger.error(
          `Unexpected error occurred forwarding the proxy payload: ${err}\n${err.stack}`,
        );
        req.emit('payloadError', 'An unexpected Airlock error occurred');
      }
    });
  });

  return {
    web(req, res, next) {
      // Setup forwarding to next controller, if proxy passes
      req.on('payloadError', (err: string) => {
        next(err);
      });
      req.on('payloadReady', (payload: string) => {
        req.context = JSON.parse(payload) as
          | Record<any>
          | { records: Record<any>[] };
        next();
      });

      if (req.method === 'GET') {
        const content = cache.get(req);
        if (content.data) {
          res.setHeader('content-type', content.contentType);
          req.emit('payloadReady', content.data);
          return;
        }

        proxy.web(req, res, {
          target: AIRTABLE_API_BASE_URL,
        });
      } else {
        cache.clear(req);
        proxy.web(req, res, {
          target: AIRTABLE_API_BASE_URL,
        });
      }
    },

    async hydrateRecordIds(req, _res, next) {
      if (Array.isArray(req.query.records)) {
        req.body = {
          records: await fetchRecordsByIds(
            req.query.records,
            req.params.tableName,
            options,
          ),
        };
      }
      next();
    },

    flattenRecordsToIds(req, _res, next) {
      if (req.body && Array.isArray(req.body.records)) {
        const ids = req.body.records.map((record: Record<any>) => record.id);
        const parsedUrl = url.parse(req.url, true);
        parsedUrl.query.records = ids;

        req.url = url.format(parsedUrl);
        req.query.records = ids;
      }
      next();
    },
  };
};
