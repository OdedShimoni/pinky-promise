import sinon from 'sinon';
import * as index from '../../src';
index.PinkyPromise.config();

describe('Inner promise resolves flows:', () => {
    test('promise is resolved and succeeded at the first time', async () => {
        const pinky = new index.PinkyPromise(
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
        const pinky = new index.PinkyPromise(
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
        const pinky = new index.PinkyPromise(
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
            expect(e instanceof index.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('promise is resolved and NOT succeeded but EXCEEDS number of retries and SUCCEEDS in the 2nd revert attempt', async () => {
        let revertCounter = 0;
        const pinky = new index.PinkyPromise(
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
            expect(e instanceof index.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(2);
        }
    });

    test('promise is resolved and NOT succeeded but EXCEEDS number of retries and NOT succeeded in the reverts', async () => {
        const pinky = new index.PinkyPromise(
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
            expect(e instanceof index.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(5);
        }
    });

    test('an error is thrown inside "success"', async () => {
        const pinky = new index.PinkyPromise(
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
        }
        catch (e) {
            expect(e instanceof index.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(0);
        }
    });

    test('promise is resolve and NOT succeeded but EXCEEDS number of retries and revert THROWS an error', async () => {
        const pinky = new index.PinkyPromise(
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
            expect(e instanceof index.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });


    test('user sets different number of retries and reverts', async () => {
        const pinky = new index.PinkyPromise(
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
            expect(e instanceof index.FatalErrorNotReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(11); // 1 for the first time and 10 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(20);
        }
    });

    test('flow which user sets "isRetryable" to "false"', async () => {
        const pinky = new index.PinkyPromise(
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
            expect(e instanceof index.PromiseFailedAndReverted).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky['_retry'] as sinon.Spy).callCount).toBe(0);
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky.then as sinon.Spy).callCount).toBe(1);
        }
    });

    test('flow which user sets "revertOnFailure" to "false"', async () => {
        const pinky = new index.PinkyPromise(
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
            expect(e instanceof index.PromiseFailed).toBe(true);
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6);
            expect((pinky['_retry'] as sinon.Spy).callCount).toBe(5);
            expect((pinky.then as sinon.Spy).callCount).toBe(1);
        }
    });
});

describe('Inner promise rejects flows:', () => {
    it.todo('promise is rejected succeeds in the retries');
});