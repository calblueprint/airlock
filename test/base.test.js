'use strict';
var request = require('request');
var version = require('../package.json').version;
var Airtable = require('../lib/airtable');

jest.mock('request', () => jest.fn((options, cb) => {
    cb(null, {
        user: {
            username: options.body && options.body.username
        },
        token: 'tokXyz'
    });
}));

// class LocalStorageMock {
//     constructor() {
//         this.store = {};
//     }

//     getItem(key) {
//         return this.store[key] || null;
//     }

//     setItem(key, value) {
//         this.store[key] = value.toString();
//     }
// }

// global.localStorage = new LocalStorageMock();

describe('Base', function() {
    afterEach(function() {
        localStorage.clear();
        jest.clearAllMocks();
    });
    ['login', 'register'].forEach((authFunction) => {
        describe(`#${authFunction}`, function() {
            it('disallows requests to the official API endpoint', async function() {
                let fakeAirtable = new Airtable({
                    apiKey: 'keyXyz'
                });
                const base = fakeAirtable.base('app123');
                expect.assertions(2);
                expect(fakeAirtable._endpointUrl).toBe('https://api.airtable.com');
    
                try {
                    await base[authFunction]({
                        username: 'user',
                        password: 'password'
                    });
                } catch (err) {
                    expect(err.message).toMatch(`Base#${authFunction} cannot be used with api.airtable.com.`
                    + ' Please configure this Airlock client to use an Airlock endpoint URL.');
                }
            });

            // Correctly configured Airlock client
            const airtable = new Airtable({
                apiKey: 'airlock',
                endpointUrl: 'test',
                requestTimeout: 1234
            });
            let base = airtable.base('app123');

            it('requires username and password', async function() {
                expect.assertions(2);
                try {
                    await base[authFunction]({
                        password: 'password'
                    });
                } catch (err) {
                    expect(err.message).toMatch(`Missing parameter 'username' required for Base#${authFunction}`);
                }

                try {
                    await base[authFunction]({
                        username: 'user'
                    });
                } catch (err) {
                    expect(err.message).toMatch(`Missing parameter 'password' required for Base#${authFunction}`);
                }
            });
            it('makes authentication requests with the right options', async function() {
                base = airtable.base('app123');

                base[authFunction]({
                    username: 'user',
                    password: 'password'
                });
                expect(request).toHaveBeenCalledTimes(1);
                expect(request).toHaveBeenCalledWith({
                    method: 'POST',
                    url: `test/v0/app123/${authFunction}?`,
                    json: true,
                    headers: {
                        authorization: 'Bearer airlock',
                        'x-api-version': '0.1.0',
                        'x-airtable-application-id': 'app123',
                        'x-airtable-user-agent': 'Airtable.js/' + version
                    },
                    agentOptions: {
                        rejectUnauthorized: false
                    },
                    body: {
                        username: 'user',
                        password: 'password'
                    },
                    timeout: 1234
                }, expect.any(Function));
            });
        });
    });

    describe('#login+logout', function() {
        const airtable = new Airtable({
            apiKey: 'airlock',
            endpointUrl: 'test',
            requestTimeout: 1234
        });
        let base = airtable.base('app123');
        it('stores the resulting user and token within the Airtable client', function() {
            expect.assertions(3);
            return base.login({
                username: 'user',
                password: 'password'
            }).then(() => {
                expect(base.getUser()).not.toBe(null);
                expect(base.getUsername()).toBe('user');
                expect(base.getToken()).toBe('tokXyz');
            });
        });

        it('properly logs out a user by deleting user properties in localStorage', function() {
            base.logout();
            return new Promise(() => {
                expect(base.getUser()).toBe(null);
                expect(base.getUsername()).toBe(null);
                expect(base.getToken()).toBe(null);
            });
        });
    });

    describe('#runAction', function() {
        it('makes requests with the right options', function() {
            var fakeAirtable = new Airtable({
                apiKey: 'keyXyz',
                requestTimeout: 1234
            });
            var fakeBase = fakeAirtable.base('app123');

            fakeBase.runAction('get', '/my_table/rec456', {}, null, function() {});

            expect(request).toHaveBeenCalledTimes(1);
            expect(request).toHaveBeenCalledWith({
                method: 'GET',
                url: 'https://api.airtable.com/v0/app123/my_table/rec456?',
                json: true,
                timeout: 1234,
                headers: {
                    authorization: 'Bearer keyXyz',
                    'x-api-version': '0.1.0',
                    'x-airtable-application-id': 'app123',
                    'x-airtable-user-agent': 'Airtable.js/' + version
                },
                agentOptions: {
                    rejectUnauthorized: false
                }
            }, expect.any(Function));

            expect(version).toEqual(expect.stringMatching(/^\d+\.\d+\.\d+$/));
        });
    });
});