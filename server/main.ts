require('dotenv').config();

import Airtable from 'airtable';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import http from 'http';
import path from 'path';

import AccessController from './controllers/accessController';
import AuthController from './controllers/authController';
import ProxyController from './controllers/proxyController';
import { AuthorizationError, InputError } from './lib/errors';
import logger from './utils/logger';
import validators from './validators';

export type AirlockAccessResolver = (
  record: Airtable.Record<object>,
  user: Airtable.Record<object>,
) =>
  | boolean
  | Airtable.Record<object>
  | Promise<boolean | Airtable.Record<object>>;

export type AirlockInitOptions = {
  server?: express.Application;
  port?: number;
  allowedOrigins?: string[];
  configDir?: string;
  resolversDir?: string;
  disableHashPassword?: boolean;
  saltRounds?: number;
  /**
   * Pass in a duration string accepted by zeit/ms, i.e. "30d"
   */
  expirationDuration?: string;
  /**
   * Specify an array of API keys for this field to rotate across a set of keys per request.
   */
  airtableApiKey: string | string[];
  airtableBaseId: string;
  airtableUserTableName: string;
  airtableUsernameColumn: string;
  airtablePasswordColumn: string;
};

export type AirlockOptions = Required<
  Omit<AirlockInitOptions, 'server' | 'airtableApiKey'>
> & {
  airtableApiKey: string[];
  apiKeyIndex: number;
  publicKey: string;
  privateKey: string;
  accessResolvers: Record<string, AirlockAccessResolver>;
};

export type AirlockController<
  T extends { [actionName: string]: ParamsDictionary }
> = {
  [K in keyof T]: express.RequestHandler<T[K]>;
};

type AirlockOptionStatus = { valid: boolean; reasons?: any[] };

class Airlock {
  server: express.Application;
  options: AirlockOptions;
  optionValidators: Partial<
    {
      [K in keyof AirlockOptions]: (value: AirlockOptions[K]) => void;
    }
  > = validators;

  constructor(opts: AirlockInitOptions) {
    let { server, airtableApiKey, ...options } = opts;
    if (!Array.isArray(airtableApiKey)) {
      airtableApiKey = [airtableApiKey];
    }

    // Set defaults for config, if they aren't set
    this.options = {
      port: Number(process.env.PORT) || 4000,
      publicKey: '',
      privateKey: '',
      airtableApiKey,
      apiKeyIndex: 0,
      expirationDuration: '14d',
      disableHashPassword: false,
      saltRounds: 5,
      configDir: 'config',
      resolversDir: 'resolvers',
      accessResolvers: {},
      allowedOrigins: [],
      ...options,
    };
    this.options.resolversDir = path.resolve(
      process.cwd(),
      this.options.resolversDir,
    );
    this.options.configDir = path.resolve(
      process.cwd(),
      this.options.configDir,
    );
    this.options.accessResolvers = require(this.options.resolversDir);

    const { PUBLIC_KEY, PRIVATE_KEY } = process.env;
    if (PUBLIC_KEY) {
      fs.writeFileSync(
        path.join(this.options.configDir, 'jwt.key.pub'),
        PUBLIC_KEY,
      );
    }
    if (PRIVATE_KEY) {
      fs.writeFileSync(
        path.join(this.options.configDir, 'jwt.key'),
        PRIVATE_KEY,
      );
    }
    const status: AirlockOptionStatus = this.validateOptions();
    if (!status.valid) {
      logger.error('⚠️ Airlock could not start:', status.reasons);
      process.exit(1);
    }

    this.options = { ...this.options, ...this.readConfigFiles() };
    if (!server) {
      this.createServer();
    } else {
      this.server = server;
    }
    this.mountAirlock();
  }

  validateOptions(): AirlockOptionStatus {
    const validations: AirlockOptionStatus[] = Object.keys(
      this.optionValidators,
    ).map(
      (optionKey: string): AirlockOptionStatus => {
        try {
          this.optionValidators[optionKey](this.options[optionKey]);
        } catch (err) {
          return { valid: false, reasons: [err.message] };
        }
        return { valid: true };
      },
    );

    return validations.reduce(
      (globalStatus: AirlockOptionStatus, nextStatus: AirlockOptionStatus) => {
        return {
          valid: globalStatus.valid && nextStatus.valid,
          reasons: nextStatus.reasons
            ? [...globalStatus.reasons, ...nextStatus.reasons]
            : globalStatus.reasons,
        };
      },
      { valid: true, reasons: [] },
    );
  }

  readConfigFiles(): { publicKey: string; privateKey: string } {
    const publicKeyPath = path.resolve(this.options.configDir, 'jwt.key.pub');
    const privateKeyPath = path.resolve(this.options.configDir, 'jwt.key');
    return {
      publicKey: fs.readFileSync(publicKeyPath).toString(),
      privateKey: fs.readFileSync(privateKeyPath).toString(),
    };
  }

  createServer(): void {
    this.server = express();
    const server = http.createServer(this.server);
    server.listen(this.options.port);
  }

  mountAirlock(): void {
    const app: express.Application = this.server;
    const authController = AuthController(this.options);
    const proxyController = ProxyController(this.options);
    const accessController = AccessController(this.options);

    app.use((req, res, next) => {
      if (this.options.allowedOrigins.length === 0) {
        // Permit all, if allowedOrigins is unspecified
        res.header('Access-Control-Allow-Origin', '*');
      } else {
        if (this.options.allowedOrigins.includes(req.get('origin'))) {
          res.header('Access-Control-Allow-Origin', req.get('origin'));
          res.header('Access-Control-Allow-Credentials', 'true');
        } else {
          // In case the Origin header is unspecified, we'll use the first
          // allowed origin for the CORS header
          res.header(
            'Access-Control-Allow-Origin',
            this.options.allowedOrigins[0],
          );
        }
      }

      res.header(
        'Access-Control-Allow-Methods',
        ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'].join(', '),
      );
      res.header(
        'Access-Control-Allow-Headers',
        [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'x-airtable-user-agent',
          'x-airtable-application-id',
          'x-api-version',
          'authorization',
          'token',
        ].join(', '),
      );
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      return next();
    });

    app.post(
      '/:version/:baseId/__airlock_register__',
      bodyParser.json(),
      authController.checkForExistingUser,
      authController.register,
    );

    app.post(
      '/:version/:baseId/__airlock_login__',
      bodyParser.json(),
      authController.checkForExistingUser,
      authController.login,
    );

    app.post('/:version/:baseId/__airlock_logout__', authController.logout);

    app.all(
      '/:version/:baseId/:tableName/:recordId?',
      cookieParser(),
      bodyParser.json(),
      authController.verifyToken,
      proxyController.hydrateRecordIds,
      accessController.filterRequest,
      proxyController.flattenRecordsToIds,
      proxyController.web,
      accessController.filterResponse,
    );

    app.use(
      (
        err: any,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        if (err instanceof InputError) {
          return res.status(400).send({ success: false, error: err });
        }
        if (err instanceof AuthorizationError) {
          return res.status(401).send({ success: false, error: err });
        }

        // Unexpected errors
        console.error(err);
        if (err instanceof Error) {
          err = err.toString();
        }
        if (typeof err === 'object') {
          err = JSON.stringify(err);
        }
        return res.status(500).send({ error: err });
      },
    );
    logger.info(`🚀 Airlock mounted and running on port ${this.options.port}`);
    if (this.options.allowedOrigins.length === 0) {
      logger.warn(
        `No allowedOrigins specified. Defaulting to permit all cross-origin requests.`,
      );
    }
  }
}

export default Airlock;
export * from './utils/accessResolvers';
