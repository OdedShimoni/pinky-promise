import sinon from 'sinon';
import { errors, PinkyPromise } from '../../src';
PinkyPromise.config();

const DEFAULT_RETRY_ATTEMPTS = 5;
const DEFAULT_REVERT_ATTEMPTS = 5;
const ASYNC_WAIT_TIME_MS = 100;

describe('Sync flows:', () => {
    it.todo('Add reject flows');
    test('promise is resolved and succeeded at the first time', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => true,
                revert: () => false,
            }
        );
        const _pinkyThenSpy = sinon.spy(pinky, 'then');
        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        const res = await pinky;

        expect(res).toBe('resolve');
        /**
         * I hack here to access the private property _config
         */
        expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
        expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(0);
        expect((pinky.then as sinon.Spy).callCount).toBe(1);
    });

    test('promise is resolved and NOT succeeded but succeeds in the retries', async () => {
        let counter = 1;
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                counter++;
                resolve('resolve');
            },
            {
                success: function() {
                    return counter === 4
                },
                revert: () => false,
            }
        );

        const _pinkyThenSpy = sinon.spy(pinky, 'then');
        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');
        
        const res = await pinky;

        expect(res).toBe('resolve');
        expect((pinky['_config'].success as sinon.Spy).callCount).toBe(3);
        expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(0);
    });

    test('promise is resolved and NOT succeeded but EXCEEDS number of retries and SUCCEEDS in the 1st revert attempt', async () => {
        let counter = 1;
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                counter++;
                resolve('resolve');
            },
            {
                success: () => false,
                revert: () => true,
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('promise is resolved and NOT succeeded but EXCEEDS number of retries and SUCCEEDS in the 2nd revert attempt', async () => {
        let revertCounter = 0;
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: function() {
                    return ++revertCounter === 2;
                }
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(2);
        }
    });

    test('promise is resolved and NOT succeeded but EXCEEDS number of retries and NOT succeeded in the reverts', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: () => false,
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');
        
        try {
            await pinky;
            expect(true).toBe(false);
        }
        catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(DEFAULT_REVERT_ATTEMPTS);
        }
    });

    test('an error is thrown inside the executor', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                throw new Error('error in executor');
            },
            {
                success: function() {
                    return true;
                },
                revert: function() {
                    return true;
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');
        const _pinkyRetrySpy = sinon.spy(pinky, '_retry');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(0); // 0 because the promise is not resolved and error is thrown before 'success' method is called
            expect((pinky['_retry'] as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 5 actual retries and 1 returns before actually retrying
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('an error is thrown inside the executor AND revert fails', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                throw new Error('error in executor');
            },
            {
                success: function() {
                    return true;
                },
                revert: function() {
                    return false;
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');
        const _pinkyRetrySpy = sinon.spy(pinky, '_retry');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(0); // 0 because the promise is not resolved and error is thrown before 'success' method is called
            expect((pinky['_retry'] as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 5 actual retries and 1 returns before actually retrying
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(DEFAULT_REVERT_ATTEMPTS);
        }
    });

    test('an error is thrown inside "success" and promise is reverted', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => {
                    throw new Error('error while checking success');
                },
                revert: () => true,
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('an error is thrown inside "success" and revert FAILS', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => {
                    throw new Error('error while checking success');
                },
                revert: () => false,
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(DEFAULT_REVERT_ATTEMPTS);
        }
    });

    test('promise is resolve and NOT succeeded but EXCEEDS number of retries and revert THROWS an error', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: () => {
                    throw new Error('error while reverting');
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        }
        catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('user sets different number of retries and reverts', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: () => false,
                maxRetryAttempts: 10,
                maxRevertAttempts: 20,
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');
        
        try {
            await pinky;
            expect(true).toBe(false);
        }
        catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(11); // 1 for the first time and 10 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(20);
        }
    });

    test('flow which user sets "isRetryable" to "false"', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: () => true,
                isRetryable: false,
            }
        );

        const _pinkyThenSpy = sinon.spy(pinky, 'then');
        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');
        const _pinkyRetry = sinon.spy(pinky, '_retry');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky['_retry'] as sinon.Spy).callCount).toBe(0);
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky.then as sinon.Spy).callCount).toBe(1);
        }
    });

    test('flow which user sets "revertOnFailure" to "false"', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revertOnFailure: false,
            }
        );

        const _pinkyThenSpy = sinon.spy(pinky, 'then');
        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRetry = sinon.spy(pinky, '_retry');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailed).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1);
            expect((pinky['_retry'] as sinon.Spy).callCount).toBe(DEFAULT_REVERT_ATTEMPTS);
            expect((pinky.then as sinon.Spy).callCount).toBe(1);
        }
    });
});

describe('Async flows:', () => {
    test('"revert" is also async', async () => {
        const pinky = new PinkyPromise(
            async (resolve, reject) => {
                setTimeout(() => {
                    resolve('resolve');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: () => false,
                revert: () => {
                    setTimeout(() => {
                        return true;
                    }, ASYNC_WAIT_TIME_MS);
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('"revert" is also async but now it rejects on the 1st attempt', async () => {
        let revertCounter = 0;
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                setTimeout(() => {
                    resolve('resolve');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: () => false,
                revert: function() {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            return reject(++revertCounter === 2);
                        }, ASYNC_WAIT_TIME_MS);
                    });
                }
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('executor rejects and async revert succeeds', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                setTimeout(() => {
                    reject('error in executor');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: function() {
                    return true;
                },
                revert: function() {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            return resolve(true);
                        }, ASYNC_WAIT_TIME_MS);
                    });
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');
        const _pinkyRetrySpy = sinon.spy(pinky, '_retry');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(0); // 0 because the promise is not resolved and error is thrown before 'success' method is called
            expect((pinky['_retry'] as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 5 actual retries and 1 returns before actually retrying
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('an error is thrown inside "success" and promise is ASYNCLY reverted', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                setTimeout(() => {
                    resolve('resolve');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: () => {
                    throw new Error('error while checking success');
                },
                revert: () => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            return resolve(true);
                        }, ASYNC_WAIT_TIME_MS);
                    });
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('an error is thrown inside "success" and ASYNC revert FAILS', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                setTimeout(() => {
                    resolve('resolve');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: () => {
                    throw new Error('error while checking success');
                },
                revert: () => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            return resolve(false);
                        }, ASYNC_WAIT_TIME_MS);
                    });
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(DEFAULT_REVERT_ATTEMPTS);
        }
    });

    test('promise is resolve and NOT succeeded but EXCEEDS number of retries and ASYNC revert THROWS an error on the 2nd attmept', async () => {
        let counter = 0;
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                setTimeout(() => {
                    resolve('resolve');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: () => false,
                revert: () => {
                    if (counter === 0) {
                        counter++;
                        return false;
                    }
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            throw new Error('error while reverting');
                        }, ASYNC_WAIT_TIME_MS);
                    });
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        }
        catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('promise is resolve and NOT succeeded but EXCEEDS number of retries and ASYNC revert REJECTS', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                setTimeout(() => {
                    resolve('resolve');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: () => false,
                revert: () => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            reject(new Error('error while reverting'));
                        }, ASYNC_WAIT_TIME_MS);
                    });
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        }
        catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('promise is resolve and NOT succeeded but EXCEEDS number of retries and ASYNC revert REJECTS on the 2nd attempt', async () => {
        let counter = 0;
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                setTimeout(() => {
                    resolve('resolve');
                }, ASYNC_WAIT_TIME_MS);
            },
            {
                success: () => false,
                revert: () => {
                    if (counter === 0) {
                        counter++;
                        return false;
                    }
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            reject(new Error('error while reverting'));
                        }, ASYNC_WAIT_TIME_MS);
                    });
                },
            }
        );

        const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
        const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

        try {
            await pinky;
            expect(true).toBe(false);
        }
        catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(DEFAULT_RETRY_ATTEMPTS + 1); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(2);
        }
    });
});
