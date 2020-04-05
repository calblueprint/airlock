require('dotenv').config();

import bodyParser from 'body-parser';
import fs from 'fs';
import express from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import http from 'http';
import path from 'path';

import AuthController from './controllers/authController';
import ProxyController from './controllers/proxyController';
import { AuthorizationError, InputError } from './lib/errors';
import validators from './validators';

export type AirlockInitOptions = {
  server?: express.Application;
  port?: number;
  configDir?: string;
  resolversDir?: string;
  disableHashPassword?: boolean;
  saltRounds?: number;
  airtableApiKey: string;
  airtableBaseId: string;
  airtableUserTableName: string;
  airtableUsernameColumn: string;
  airtablePasswordColumn: string;
};
export type AirlockOptions = Required<Omit<AirlockInitOptions, 'server'>> & {
  publicKey: string;
  privateKey: string;
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

    const { server, ...options } = opts;
    this.options = {
      port: Number(process.env.PORT) || 4000,
      resolversDir: path.resolve(process.cwd(), 'resolvers'),
      configDir: path.resolve(process.cwd(), 'config'),
      publicKey: '',
      privateKey: '',
      disableHashPassword: false,
      saltRounds: 5,
      ...options,
    };

    const status: AirlockOptionStatus = this.validateOptions();
    if (!status.valid) {
      console.error('⚠️ Airlock could not start:');
      status.reasons.forEach((reason: any) => {
        console.error(`- ${reason}`);
      });
      process.exit(1);
    }

    this.options = { ...this.options, ...this.readConfigFiles() };
    if (!server) {
      this.createServer();
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

    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
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

    app.all(
      '/:version/:baseId/:tableIdOrName*',
      authController.verifyToken,
      proxyController.web,
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
    console.log(`🚀 Airlock mounted and running on port ${this.options.port}`);
  }
}

export default Airlock;