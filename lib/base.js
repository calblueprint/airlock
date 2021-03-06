"use strict";

var forEach = require("lodash/forEach");

var AirtableError = require("./airtable_error");
var Table = require("./table");
var runAction = require("./run_action");
var callbackToPromise = require("./callback_to_promise");

const isReactNative =
  typeof document === "undefined" &&
  typeof navigator !== "undefined" &&
  navigator.product === "ReactNative";

function Base(airtable, baseId) {
  this._airtable = airtable;
  this._id = baseId;
  this._user = this._getLocalStorage("user");
  this._token = this._getLocalStorage("token");
  this.register = callbackToPromise(this.register, this);
  this.login = callbackToPromise(this.login, this);
  this.logout = callbackToPromise(this.logout, this);
}

Base.prototype.table = function (tableName) {
  return new Table(this, null, tableName);
};

Base.prototype.runAction = function (
  method,
  path,
  queryParams,
  bodyData,
  callback
) {
  runAction(this, method, path, queryParams, bodyData, callback, 0);
};

Base.prototype._checkStatusForError = function (statusCode, body) {
  if (statusCode === 401) {
    return new AirtableError(
      "AUTHENTICATION_REQUIRED",
      "You should provide valid api key to perform this operation",
      statusCode
    );
  } else if (statusCode === 400 || statusCode === 403) {
    return new AirtableError(
      "NOT_AUTHORIZED",
      "You are not authorized to perform this operation",
      statusCode
    );
  } else if (statusCode === 404) {
    return (function () {
      var message =
        body && body.error && body.error.message
          ? body.error.message
          : "Could not find what you are looking for";
      return new AirtableError("NOT_FOUND", message, statusCode);
    })();
  } else if (statusCode === 413) {
    return new AirtableError(
      "REQUEST_TOO_LARGE",
      "Request body is too large",
      statusCode
    );
  } else if (statusCode === 422) {
    return (function () {
      var type =
        body && body.error && body.error.type
          ? body.error.type
          : "UNPROCESSABLE_ENTITY";
      var message =
        body && body.error && body.error.message
          ? body.error.message
          : "The operation cannot be processed";
      return new AirtableError(type, message, statusCode);
    })();
  } else if (statusCode === 429) {
    return new AirtableError(
      "TOO_MANY_REQUESTS",
      "You have made too many requests in a short period of time. Please retry your request later",
      statusCode
    );
  } else if (statusCode === 500) {
    return new AirtableError(
      "SERVER_ERROR",
      "Try again. If the problem persists, contact support.",
      statusCode
    );
  } else if (statusCode === 503) {
    return new AirtableError(
      "SERVICE_UNAVAILABLE",
      "The service is temporarily unavailable. Please retry shortly.",
      statusCode
    );
  } else if (statusCode >= 400) {
    return (function () {
      var type =
        body && body.error && body.error.type
          ? body.error.type
          : "UNEXPECTED_ERROR";
      var message =
        body && body.error && body.error.message
          ? body.error.message
          : "An unexpected error occurred";
      return new AirtableError(type, message, statusCode);
    })();
  } else {
    return null;
  }
};

Base.prototype.register = function ({ username, password, fields }, done) {
  if (!username) {
    throw new AirtableError(
      "NOT_FOUND",
      "Missing parameter 'username' required for Base#register",
      404
    );
  }
  if (!password) {
    throw new AirtableError(
      "NOT_FOUND",
      "Missing parameter 'password' required for Base#register",
      404
    );
  }
  if (this._airtable._endpointUrl.includes("https://api.airtable.com")) {
    throw new AirtableError(
      "NOT_AUTHORIZED",
      "Base#register cannot be used with api.airtable.com. Please configure this Airlock client to use an Airlock endpoint URL.",
      403
    );
  }
  runAction(
    this,
    "post",
    "/__airlock_register__",
    {},
    { username, password, fields },
    (err, data) => {
      this._user = data.body.user;
      this._token = data.body.token;
      Promise.all([
        this._setLocalStorage("airlock_user", this._user),
        this._setLocalStorage("airlock_token", this._token),
      ])
        .then(() => {
          done(err, data);
        })
        .catch((error) => done(error));
    }
  );
};

Base.prototype.login = function ({ username, password }, done) {
  if (!username) {
    throw new AirtableError(
      "NOT_FOUND",
      "Missing parameter 'username' required for Base#login",
      404
    );
  }
  if (!password) {
    throw new AirtableError(
      "NOT_FOUND",
      "Missing parameter 'password' required for Base#login",
      404
    );
  }
  if (this._airtable._endpointUrl.includes("https://api.airtable.com")) {
    throw new AirtableError(
      "NOT_AUTHORIZED",
      "Base#login cannot be used with api.airtable.com. Please configure this Airlock client to use an Airlock endpoint URL.",
      403
    );
  }
  runAction(
    this,
    "post",
    "/__airlock_login__",
    {},
    { username, password },
    (err, data) => {
      this._user = data.body.user;
      this._token = data.body.token;
      Promise.all([
        this._setLocalStorage("airlock_user", this._user),
        this._setLocalStorage("airlock_token", this._token),
      ])
        .then(() => {
          done(err, data);
        })
        .catch((error) => done(error));
    }
  );
};

Base.prototype.logout = function (done) {
  if (this._airtable._endpointUrl.includes("https://api.airtable.com")) {
    throw new AirtableError(
      "NOT_AUTHORIZED",
      "Base#logout cannot be used with api.airtable.com. Please configure this Airlock client to use an Airlock endpoint URL.",
      403
    );
  }
  this._user = null;
  this._token = null;
  runAction(this, "post", "/__airlock_logout__", {}, {}, (err, data) => {
    Promise.all([
      this._setLocalStorage("airlock_user", ""),
      this._setLocalStorage("airlock_token", ""),
    ])
      .then(() => {
        done(err, data);
      })
      .catch((error) => done(error));
  });
};

Base.prototype._setLocalStorage = function (_key, _value) {
  // setLocalStorage is a no-op in this context
};

Base.prototype._getLocalStorage = function (_key) {
  // getLocalStorage is a no-op in this context
};

if (isReactNative) {
  console.log(
    "@calblueprint/airlock initialized for React Native. Tokens will be stored in AsyncStorage."
  );
  const AsyncStorage = require("react-native").AsyncStorage;
  Base.prototype._setLocalStorage = function (key, value) {
    return AsyncStorage.setItem(key, JSON.stringify(value));
  };

  Base.prototype._getLocalStorage = function (key) {
    return AsyncStorage.getItem(key).then((value) => {
      return JSON.parse(value);
    });
  };
}

Base.prototype.doCall = function (tableName) {
  return this.table(tableName);
};

Base.prototype.getId = function () {
  return this._id;
};

Base.prototype.getUser = function () {
  if (this._user) {
    return Promise.resolve(this._user);
  }
  return this._getLocalStorage("airlock_user");
};

Base.prototype.getUsername = function () {
  if (this._token === null || this._user === null) {
    return null;
  }
  return this._user.username;
};

Base.prototype.getToken = function () {
  if (this._token) {
    return Promise.resolve(this._token);
  }
  return this._getLocalStorage("airlock_token");
};

Base.createFunctor = function (airtable, baseId) {
  var base = new Base(airtable, baseId);
  var baseFn = function () {
    return base.doCall.apply(base, arguments);
  };
  forEach(
    [
      "table",
      "runAction",
      "getId",
      "register",
      "login",
      "logout",
      "getUser",
      "getUsername",
      "getToken",
    ],
    function (baseMethod) {
      baseFn[baseMethod] = base[baseMethod].bind(base);
    }
  );
  baseFn._base = base;
  baseFn.tables = base.tables;
  return baseFn;
};

module.exports = Base;
