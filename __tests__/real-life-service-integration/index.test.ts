/**
 * * Tests here are dependent on Docker being installed on the machine running the tests and docker-compose + ports available
 * 
 * I commented out MySQL pinkies because I made this file in a rush and I couldn't find a better solution other
 * than mixing async/await flows with 'then' ones, since mysql2/promise didn't work for some reason - feel free to fix.
 * 
 * However we need to remember we don't test specific clients, even though it would be good to have a few,
 * but not necessary.
 */
jest.setTimeout(120000);
import { spawnSync } from 'child_process';
import * as mongodb from 'mongodb';
import path from 'path';
import { createClient } from 'redis';
import { v4 as uuidv4 } from "uuid";
import { errors, PinkyPromise } from '../../src';
PinkyPromise.config();

let mongoClient: mongodb.MongoClient;
// let mysqlConnectionPool: mysql.Pool;
let redisClient;

beforeAll(done => {
    console.log('Setting up integration env...');
    setupTestEnv();
    setTimeout(() => {
        done();
    }, 5000); // bad practice
});

beforeAll(done => {
    mongodb.MongoClient.connect('mongodb://localhost:27017')
        .then((client) => {
            mongoClient = client;
            done();
        });
});

beforeAll(done => {
    redisClient = createClient();
    redisClient.on('error', e => {
        console.error(e);
        throw e;
    });
    redisClient.connect()
        .then(() => {
            done();
        });
});

afterAll(() => {
    mongoClient.close();
    redisClient.quit();
    teardownTestEnv();
});

describe('Full integration flows testing real life services', () => {
    test('Successful insertion to MongoDb + Redis should result with a new record in the DB.', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise-all-succeed" } }, { upsert: true })
            );
        }, {
            success: function (result) {
                return result?.acknowledged === true;
            },
            revert: async function () {
                const res = await db
                    .collection('tests')
                    .deleteOne({ id: uuid4 });
                return res.acknowledged === true;
            },
            retryMsDelay: 400,
        });

        const redisAction = new PinkyPromise<any>((resolve, reject) => {
            redisClient.set('test', 'test_value')
                .then(res => {
                    resolve(res);
                })
                .catch(e => {
                    reject(e);
                });
        }, {
            success: function (result) {
                return result === 'OK';
            },
            revert: function () {
                redisClient.del('test');
            }
        });

        try {
            await PinkyPromise.all([updateUserInfo, redisAction]);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).not.toBe(null);
            expect(insertedRowToMongo?.testing).toBe('pinky-promise-all-succeed');
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe('test_value');
        } catch (e) {
            expect(true).toBe(false);
        }
    });

    test('All revert if one fails (redis)', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise-redis-failed" } }, { upsert: true })
            );
        }, {
            success: function (result) {
                return result?.acknowledged === true;
            },
            revert: async function () {
                const res = await db
                    .collection('tests')
                    .deleteOne({ id: uuid4 });
                return res.acknowledged === true;
            },
            retryMsDelay: 400,
        });

        const redisAction = new PinkyPromise<any>((resolve, reject) => {
            redisClient.set('test', 'test_value')
                .then(res => {
                    resolve(res);
                })
                .catch(e => {
                    reject(e);
                });
        }, {
            success: function (result) {
                return false;
            },
            revert: function () {
                redisClient.del('test');
            }
        });

        try {
            await PinkyPromise.all([updateUserInfo, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });

    test('All revert if one fails (Mongo)', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise-mongo-failed" } }, { upsert: true })
            );
        }, {
            success: function (result) {
                return false;
            },
            revert: async function () {
                const res = await db
                    .collection('tests')
                    .deleteOne({ id: uuid4 });
                return res.acknowledged === true;
            },
            retryMsDelay: 400,
        });
    
        const redisAction = new PinkyPromise<any>((resolve, reject) => {
            redisClient.set('test', 'test_value')
                .then(res => {
                    resolve(res);
                })
                .catch(e => {
                    reject(e);
                });
        }, {
            success: function (result) {
                return result === 'OK';
            },
            revert: function () {
                redisClient.del('test');
            }
        });

        try {
            await PinkyPromise.all([updateUserInfo, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });

    test('Both fail', async () => {
        let counter = 0;
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            counter++;
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: `pinky-promise-retry-not-called-after-revert-${counter}` } }, { upsert: true })
            );
        }, {
            success: function (result) {
                return false;
            },
            revert: async function () {
                const res = await db
                    .collection('tests')
                    .deleteMany({ id: uuid4 });
                return res.acknowledged === true;
            },
            retryMsDelay: 300,
        });
    
        const redisAction = new PinkyPromise<any>((resolve, reject) => {
            redisClient.set('test', 'test_value')
                .then(res => {
                    resolve(res);
                })
                .catch(e => {
                    reject(e);
                });
        }, {
            success: function (result) {
                return false;
            },
            revert: function () {
                redisClient.del('test');
            }
        });

        try {
            await PinkyPromise.all([updateUserInfo, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });
});

function setupTestEnv() {
    return spawnSync('docker-compose', ['up', '-d'], {
        cwd: path.resolve(__dirname, './'),
    });
}

function teardownTestEnv() {
    return spawnSync('docker-compose', ['down', '-v'], {
        cwd: path.resolve(__dirname, './'),
    });
}
