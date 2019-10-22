'use strict';

var version = require('../package.json').version;
var Airtable = require('../lib/airtable');
var testHelpers = require('./test_helpers');

var mockRequest = jest.fn((options) => ({
    user: {
        username: options.body.username,
    },
    token: 'tokXyz'
}));

jest.mock('request', () => {
    return {
        __esModule: true,
        default: mockRequest,
    };
});

describe('Base', function() {
    ['login', 'register'].forEach((authFunction) => {
        describe(`#${authFunction}`, function() {
            let airtable;
            let teardownAsync;
            beforeAll(function() {
                return testHelpers.getMockEnvironmentAsync().then(function(env) {
                    airtable = env.airtable;
                    teardownAsync = env.teardownAsync;
                });
            });
            afterAll(function() {
                return teardownAsync();
            });
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
            const airlockAirtable = new Airtable({
                apiKey: 'airlock',
                endpointUrl: 'https://airlock-service-test.now.sh'
            });
            let base = airlockAirtable.base('app123');

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
                await base[authFunction]({
                    username: 'user',
                    password: 'password'
                });
                expect(mockRequest).toHaveBeenCalledTimes(1);
                expect(mockRequest).toHaveBeenCalledWith({
                    method: 'POST',
                    url: `https://airlock-service-test.now.sh/${authFunction}`,
                    json: true,
                    headers: {
                        authorization: 'Bearer airlock',
                        'x-api-version': '0.1.0',
                        'x-airtable-application-id': 'app123',
                        'User-Agent': 'Airtable.js/' + version
                    },
                    agentOptions: {
                        rejectUnauthorized: false
                    }
                }, expect.any(Function));
            });
            it('stores the resulting user and token within the Airtable client', async function() {
                await base[authFunction]({
                    username: 'user',
                    password: 'password'
                });
                expect(base.user).not.toBe(null);
                expect(base.user.Username).toBe('user');
                expect(base._token).toBe('tokXyz');
            });
        });
    });

    describe('#runAction', function() {
        var request = jest.fn();
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
                    'User-Agent': 'Airtable.js/' + version
                },
                agentOptions: {
                    rejectUnauthorized: false
                }
            }, expect.any(Function));

            expect(version).toEqual(expect.stringMatching(/^\d+\.\d+\.\d+$/));
        });
    });
});