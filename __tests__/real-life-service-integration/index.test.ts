/**
 * Tests here are dependent on Docker being installed on the machine running the tests and docker-compose + ports available
 */
jest.setTimeout(120000);
import { spawnSync } from 'child_process';
import * as mongodb from 'mongodb';
import mysql from 'mysql';
import path from 'path';
import { createClient } from 'redis';
import { v4 as uuidv4 } from "uuid";
import { errors, PinkyPromise } from '../../src';
PinkyPromise.config();

let mongoClient: mongodb.MongoClient;
let mysqlConnectionPool: mysql.Pool;
let redisClient;

beforeAll(done => {
    console.log('Setting up integration env...');
    setupTestEnv();
    setTimeout(() => {
        mysqlConnectionPool = mysql.createPool({
            connectionLimit : 5,
            host: 'localhost',
            user: 'test',
            password: 'test',
            database: 'test',
        });

        mysqlConnectionPool.getConnection((err, connection) => {
            if (err) {
                console.error(err);
                throw err;
            }
            connection.query("CREATE TABLE IF NOT EXISTS test.pinky_promise_tests ("
                    + "uuid VARCHAR(36) NOT NULL,"
                    + "col VARCHAR(255) NOT NULL,"
                    + "PRIMARY KEY (uuid)"
                + ")",
                (err, results) => {
                    if (err) {
                        console.error(err);
                        throw err;
                    }
                    connection.release();
                    done();
                }
            );
        });
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
    mysqlConnectionPool.end();
    redisClient.quit();
    teardownTestEnv();
});

describe('Full integration flows testing real life services', () => {
    test('Successful insertion to MongoDb + Mysql + Redis should result with a new record in the DB.', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
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
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return result.affectedRows === 1;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                if (err) {
                    expect(true).toBe(false);
                }
                expect(res[0].col).toBe('test_value');
            });
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).not.toBe(null);
            expect(insertedRowToMongo?.testing).toBe('pinky-promise');
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
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
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
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return result.affectedRows === 1;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                expect(res[0]?.col).toBe(undefined);
            });
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });

    test('All revert if one fails (MySQL)', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
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
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return false;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                expect(res[0]?.col).toBe(undefined);
            });
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
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
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
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return result.affectedRows === 1;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                expect(res[0]?.col).toBe(undefined);
            });
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });

    test('All revert if two fail (Mongo + MySQL)', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
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
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return false;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                expect(res[0]?.col).toBe(undefined);
            });
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });

    test('All revert if two fail (MySQL + Redis)', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
            );
        }, {
            success: function (result) {
                return result.acknowledged === true;
            },
            revert: async function () {
                const res = await db
                    .collection('tests')
                    .deleteOne({ id: uuid4 });
                return res.acknowledged === true;
            },
            retryMsDelay: 400,
        });
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return false;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                expect(res[0]?.col).toBe(undefined);
            });
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });

    test('All revert if three fail (Mongo + MySQL + Redis)', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
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
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return false;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                expect(res[0]?.col).toBe(undefined);
            });
            const insertedRowToMongo = await db.collection('tests').findOne({ id: uuid4 });
            expect(insertedRowToMongo).toBe(null);
            expect(insertedRowToMongo?.testing).toBe(undefined);
            const redisValue = await redisClient.get('test');
            expect(redisValue).toBe(null);
        }
    });

    test('All revert if three fail (Mongo + MySQL + Redis) and retry isn\'t being called after revert', async () => {
        const db = mongoClient.db("tests");
        const uuid4 = uuidv4();
        const updateUserInfo = new PinkyPromise<any>((resolve, reject) => {
            resolve(
                db
                    .collection("tests")
                    .updateOne({ id: uuid4 }, { $set: { id: uuid4, testing: "pinky-promise" } }, { upsert: true })
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
    
        let updateToMysqlCounter = 0;
        const updateMySql = new PinkyPromise<any>((resolve, reject) => {
            if (++updateToMysqlCounter < 4) {
                return reject();
            }
            const query = `INSERT INTO test.pinky_promise_tests (uuid, col) VALUES ('${uuid4}', 'test_value')`;
            mysqlConnectionPool.query(query, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        },
        {
            success: function (result) {
                return false;
            },
            revert: function () {
                const query = `DELETE FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`;
                mysqlConnectionPool.query(query, (err, res) => {
                    if (![0,1].includes((res as any)?.affectedRows)) {
                        return false;
                    }
                });
            }
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
            await PinkyPromise.all([updateUserInfo, updateMySql, redisAction]);
            expect(true).toBe(false);
        } catch (e) {
            setTimeout(() => {
                expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
                mysqlConnectionPool.query(`SELECT * FROM test.pinky_promise_tests WHERE uuid = '${uuid4}'`, (err, res) => {
                    expect(res[0]?.col).toBe(undefined);
                });
                db.collection('tests').findOne({ id: uuid4 })
                    .then(insertedRowToMongo => {
                        expect(insertedRowToMongo).toBe(null);
                        expect(insertedRowToMongo?.testing).toBe(undefined);
                    });
                redisClient.get('test')
                    .then(redisValue => {
                        expect(redisValue).toBe(null);
                    });
            }, 3000);
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
