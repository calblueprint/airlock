require('dotenv').config();

import bodyParser from 'body-parser';
import fs from 'fs';
import express from 'express';
import http from 'http';
import path from 'path';

import AuthController from './controllers/authController';
import ProxyController from './controllers/proxyController';
import { checkForExistingUser } from './middleware/checkForExistingUser';
import JWT from './middleware/verifyToken';

type AirlockInitOptions = {
  baseId: string;
  server?: express.Application;
  port?: number;
  configDir?: string;
  resolversDir?: string;
  airtableApiKey: string;
  airtableBaseId: string;
  airtableTableName: string;
  airtableUsernameColumn: string;
  airtablePasswordColumn: string;
};
type AirlockOptions = Required<Omit<AirlockInitOptions, 'server'>> & {
  publicKey: string;
  privateKey: string;
};
type AirlockOptionStatus = { valid: boolean; reasons?: any[] };

class Airlock {
  server: express.Application;
  options: AirlockOptions;
  optionValidators: Partial<
    {
      [K in keyof AirlockOptions]: (value: AirlockOptions[K]) => void;
    }
  > = {
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
        !fs.existsSync(path.join(configDir, 'priv.pem')) ||
        !fs.existsSync(path.join(configDir, 'pub.pem'))
      ) {
        throw new Error(
          `Could not find pub.pem or priv.pem in your configDir, '${configDir}`,
        );
      }
    },
  };

  constructor(opts: AirlockInitOptions) {
    const { PUBLIC_KEY, PRIVATE_KEY } = process.env;
    if (PUBLIC_KEY) {
      fs.writeFileSync(
        path.join(this.options.configDir, 'pub.pem'),
        PUBLIC_KEY,
      );
    }
    if (PRIVATE_KEY) {
      fs.writeFileSync(
        path.join(this.options.configDir, 'priv.pem'),
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
      ...options,
    };

    const status: AirlockOptionStatus = this.validateOptions();
    if (!status.valid) {
      console.error('Airlock could not start:');
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
    const publicKeyPath = path.resolve(this.options.configDir, 'pub.pem');
    const privateKeyPath = path.resolve(this.options.configDir, 'priv.pem');
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
      next();
    });

    app.post(
      '/:version/:base/__DANGEROUSLY__USE__TABLE__TO__LET__USERS__REGISTER',
      bodyParser.json(),
      checkForExistingUser,
      AuthController.register,
    );

    app.post(
      '/:version/:base/__DANGEROUSLY__USE__TABLE__TO__LET__USERS__LOGIN',
      bodyParser.json(),
      checkForExistingUser,
      AuthController.login,
    );

    app.all(
      '/:version/:baseId/:tableIdOrName*',
      JWT.verifyToken,
      ProxyController.web,
    );

    app.use(
      (
        err: any,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        console.error(err);
        res.status(500).send({ error: err });
      },
    );
  }
}

export default Airlock;
