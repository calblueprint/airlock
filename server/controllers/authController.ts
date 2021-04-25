import { Record } from 'airtable';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import isEmpty from 'lodash/isEmpty';
import jwt from 'jsonwebtoken';
import ms from 'ms';
import _request from 'request';
import util from 'util';

import { AuthorizationError, InputError } from '../lib/errors';
import { AirlockController, AirlockOptions } from '../main';
import tokenManagement from '../utils/tokenManagement';
import { fetchRecordsByIds, requestOptions, routes } from '../utils/airtable';
import logger from '../utils/logger';

const request = util.promisify(_request);

export default (
  opts: AirlockOptions,
): AirlockController<{
  login: {};
  logout: {};
  register: {};
  checkForExistingUser: {};
  verifyToken: {};
  checkTokenRevocation: {};
}> => {
  const {
    airtableBaseId,
    airtableUsernameColumn,
    airtablePasswordColumn,
    airtableUserTableName,
    disableHashPassword,
    expirationDuration,
    saltRounds,
    publicKey,
    privateKey,
  } = opts;

  function createToken(payload: Record<any>) {
    return jwt.sign(
      { ...payload, [airtablePasswordColumn]: undefined },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: expirationDuration,
      },
    );
  }

  function sendToken(req: Request, res: Response, token: string): void {
    res.cookie('airlock_token', token, {
      httpOnly: true,
      domain: req.hostname,
      path: '/',
      expires: new Date(Date.now() + ms(expirationDuration)),
      secure: true,
      sameSite: 'none',
    });
    res.json({
      success: true,
      token: token,
      user: req.user,
    });
  }

  return {
    async login(req, res, next) {
      if (isEmpty(req.user)) {
        return next(new AuthorizationError('Incorrect username or password'));
      }
      const password = req.body.password;
      let match: boolean = false;

      if (disableHashPassword) {
        match = req.user.fields[airtablePasswordColumn] === password;
      } else {
        match = await bcrypt.compare(
          password,
          req.user.fields[airtablePasswordColumn],
        );
      }
      if (!match) {
        return next(new AuthorizationError('Incorrect username or password'));
      }

      let token: string;
      try {
        token = createToken(req.user);
      } catch (err) {
        return next(err);
      }
      sendToken(req, res, token);
    },

    async register(req, res, next) {
      if (!isEmpty(req.user)) {
        return res.json({ success: false, message: 'User exists' });
      }
      if (!req.body.password || !req.body.password.trim()) {
        return next(new InputError('No password was specified'));
      }

      const fields = req.body.fields ? req.body.fields : {};
      let hash: string;
      try {
        hash = await bcrypt.hash(req.body.password, saltRounds);
      } catch (err) {
        return next(err);
      }

      try {
        const {
          body: { error: err, ...user },
        } = await request({
          url: routes.users({
            airtableBaseId,
            airtableUserTableName,
          }),
          method: 'POST',
          body: {
            fields: {
              ...fields,
              [airtableUsernameColumn]: req.body.username,
              [airtablePasswordColumn]: `${
                disableHashPassword ? req.body.password : hash
              }`,
            },
          },
          ...requestOptions(opts),
        });
        if (err) {
          throw err;
        }
        req.user = user;
      } catch (err) {
        return next(err);
      }

      let token: string;
      try {
        token = createToken(req.user);
      } catch (err) {
        return next(err);
      }
      sendToken(req, res, token);
    },
    async logout(req, res) {
      let token =
        (req.headers.token as string) || (req.cookies.airlock_token as string);
      logger.debug(`Token value is: ${token}`);
      if (token) {
        let value = await tokenManagement.isTokenRevoked(token);
        if (value != null) {
          return res.json({
            success: false,
            message: 'User has already been logged out',
          });
        } else {
          const revocationDate = new Date();
          let status = await tokenManagement.revokeToken(
            token,
            revocationDate.toString(),
          );
          if (status == 'OK') {
            res.cookie('airlock_token', '', { expires: new Date(Date.now()) });
            return res.json({
              success: true,
              message: 'User successfully logged out',
            });
          } else {
            return res.json({
              success: false,
              message: 'User unsuccessfully logged out',
            });
          }
        }
      } else {
        return res.json({
          success: false,
          message: 'Authorization token not supplied',
        });
      }
    },
    async checkForExistingUser(req, _res, next) {
      if (!req.body || !req.body.username) {
        return next();
      }
      const username = req.body.username;
      const queryUserUrl = routes.users(
        {
          airtableBaseId,
          airtableUserTableName,
        },
        {
          filterByFormula: `{${airtableUsernameColumn}}="${username}"`,
        },
      );

      try {
        const {
          body: { records, error },
          statusCode,
        } = await request({
          url: queryUserUrl,
          method: 'GET',
          ...requestOptions(opts),
        });
        if (error || statusCode !== 200) {
          throw new Error(
            `[Airtable error: ${error?.type || ''}] ${
              error?.message || 'unknown'
            }`,
          );
        }
        [req.user] = records;
        next();
      } catch (err) {
        next(err);
      }
    },

    verifyToken(req, _res, next) {
      let token =
        (req.headers.token as string) || (req.cookies.airlock_token as string);

      if (token) {
        jwt.verify(token, publicKey, (err, decoded) => {
          if (err) {
            return next(new AuthorizationError('Invalid token supplied'));
          }
          fetchRecordsByIds(
            [(decoded as Record<any>).id],
            opts.airtableUserTableName,
            opts,
          )
            .then(([user]) => {
              req.user = user;
              logger.debug(`Authenticated user: ${JSON.stringify(req.user)}`);
              next();
            })
            .catch((err) => next(err));
        });
      } else {
        return next(new InputError('No token supplied'));
      }
    },
    async checkTokenRevocation(req, res, next) {
      let token =
        (req.headers.token as string) || (req.cookies.airlock_token as string);
      if (token) {
        let value = await tokenManagement.isTokenRevoked(token);
        if (value != null) {
          return res.json({
            success: false,
            message: 'Token has been revoked',
          });
        } else {
          return next();
        }
      } else {
        return next(new InputError('Authorization token is not supplied'));
      }
    },
  };
};
