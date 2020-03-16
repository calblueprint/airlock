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
import AirtableRoute from '../utils/AirtableRoute';

const request = util.promisify(_request);
const TOKEN_EXPIRATION_TIME = '1d';

export default (
  opts: AirlockOptions,
): AirlockController<{
  login: {};
  register: {};
  checkForExistingUser: {};
  verifyToken: {};
}> => {
  const {
    airtableApiKey,
    airtableBaseId,
    airtableUsernameColumn,
    airtablePasswordColumn,
    airtableUserTableName,
    disableHashPassword,
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
        expiresIn: TOKEN_EXPIRATION_TIME,
      },
    );
  }

  function sendToken(req: Request, res: Response, token: string): void {
    res.cookie('airlock_token', token, {
      httpOnly: true,
      domain: req.headers.host,
      expires: new Date(new Date() + ms(TOKEN_EXPIRATION_TIME)),
    });
    res.json({
      success: true,
      token: token,
      user: req.user,
    });
  }

  const requestOptions = {
    json: true,
    timeout: 5000,
    headers: {
      authorization: `Bearer ${airtableApiKey}`,
      'x-api-version': '0.1.0',
      'x-airtable-application-id': airtableBaseId,
      'User-Agent': 'Airtable.js/0.7.1',
    },
    agentOptions: {
      rejectUnauthorized: false,
    },
  };

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

      let newUser: Record<any>;
      try {
        const {
          body: { error: err, ...user },
        } = await request({
          url: AirtableRoute.users({
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
          ...requestOptions,
        });
        if (err) {
          throw err;
        }
        newUser = user;
      } catch (err) {
        return next(err);
      }

      let token: string;
      try {
        token = createToken(newUser);
      } catch (err) {
        return next(err);
      }
      sendToken(req, res, token);
    },

    async checkForExistingUser(req, _res, next) {
      if (!req.body || !req.body.username) {
        return next();
      }
      const username = req.body.username;
      const queryUserUrl = AirtableRoute.users(
        {
          airtableBaseId,
          airtableUserTableName,
        },
        {
          filterByFormula: `${airtableUsernameColumn}="${username}"`,
        },
      );

      try {
        const {
          body: { records, error },
          statusCode,
        } = await request({
          url: queryUserUrl,
          method: 'GET',
          ...requestOptions,
        });
        if (error || statusCode !== 200) {
          throw new Error(
            `[Airtable error: ${error?.type || ''}] ${error?.message ||
              'unknown'}`,
          );
        }
        [req.user] = records;
        next();
      } catch (err) {
        next(err);
      }
    },

    verifyToken(req, _res, next) {
      let token = req.headers.token as string;
      if (token) {
        jwt.verify(token, publicKey, (err, _decoded) => {
          if (err) {
            return next(new AuthorizationError('Invalid token supplied'));
          }
          return next();
        });
      }
      return next(new InputError('No token supplied'));
    },
  };
};
