import { Record } from 'airtable';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import isEmpty from 'lodash/isEmpty';
import util from 'util';

import { AuthorizationError, InputError } from '../lib/errors';
import JWT from '../lib/jwt';
import { AirlockController, AirlockOptions } from '../main';
import AirtableRoute from '../utils/AirtableRoute';

const request = util.promisify(require('request'));

function sendToken(req: Request, res: Response, token: string): void {
  res.cookie('airlock_token', token, {
    httpOnly: true,
    domain: req.headers.host,
  });
  res.json({
    success: true,
    token: token,
    user: req.user,
  });
}

export default (
  opts: AirlockOptions,
): AirlockController<{ login: {}; register: {} }> => {
  const {
    airtableApiKey,
    airtableBaseId,
    airtableUsernameColumn,
    airtablePasswordColumn,
    airtableUserTableName,
    disableHashPassword,
    saltRounds,
  } = opts;

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
    login: async (req, res, next) => {
      if (isEmpty(req.user)) {
        return next(
          new AuthorizationError('No token supplied or session expired'),
        );
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
      const token = JWT.createToken(req.user);
      sendToken(req, res, token);
    },

    register: async (req, res, next) => {
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
        next(err);
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

      const token = JWT.createToken(newUser);
      sendToken(req, res, token);
    },
  };
};
