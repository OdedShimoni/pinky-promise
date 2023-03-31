import sinon from 'sinon';
import * as index from './src/';
import * as errors from './src/errors';
index.PinkyPromise.config();
describe('Util tests', () => {
    it('allPropertiesAreEmptyFunctions tests', () => {
        expect(index.allPropertiesAreEmptyFunctions.randomName({})).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName()).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName('randomArgument')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(1)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(true)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(null)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(undefined)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName([])).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName([1, 2, 3])).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(1, 2, 3)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName('randomArgument', 1, true, null, undefined, [])).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName({ randomProperty: 'randomValue' })).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName({ randomProperty: 1 })).toBe(undefined);

        const randomString = `_${Math.random()}`;
        expect(index.allPropertiesAreEmptyFunctions[randomString]({})).toBe(undefined);

        expect(index.allPropertiesAreEmptyFunctions.info('Info...')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.log('Log...')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.warn('Warn...')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.error('Error...')).toBe(undefined);
    });

    test('isPinkyPromiseError', () => {
        expect(errors.isPinkyPromiseError(new errors.FatalErrorNotReverted("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.ProgrammerError("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.RevertError("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.PromiseFailed("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.PromiseFailedAndReverted("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new Error('random error'))).toBe(false);

        const DifferentErrorWithSameNameAsAPinkyPromiseOne = class extends Error {
            constructor(message: string) {
                super(message);
                this.name = "FatalErrorNotReverted";
            }
        };

        expect(errors.isPinkyPromiseError(new DifferentErrorWithSameNameAsAPinkyPromiseOne("test error"))).toBe(false);
    });
});

describe('Pinky Promise mechanics tests', () => {
    it('should throw "FatalErrorNotReverted" if revert is attempted and revert function which the user inserts returns an explicit "false"', async () => {
        const pinky = new index.PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: () => false,
            }
        );

        try {
            await pinky;
        } catch (e) {
            expect(e instanceof index.FatalErrorNotReverted).toBe(true);
        }
    });

    it('should throw "ProgrammerError" if user sets "isRetryable" to "false" and "revertOnFailure" to "false"', async () => {
        try {
            const pinky = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => false,
                    revertOnFailure: false,
                    isRetryable: false,
                }
            );
        expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof index.ProgrammerError).toBe(true);
        }
    });

    it('should throw "ProgrammerError" when user sets "revertOnFailure" to "false" and sets revert method', async () => {
        try {
            new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => false,
                    revert: () => true,
                    revertOnFailure: false,
                }
            );
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof index.ProgrammerError).toBe(true);
        }
    });
});

describe('Pinky Promise flow tests', () => {

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


    describe('Group of pinky promises flows:', () => {
        test('all promises are resolved and succeeded', async () => {
            const pinky1 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revert: () => false,
                }
            );
            const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
            const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');

            const pinky2 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

            const pinky3 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');

            const res = await index.PinkyPromise.all([pinky1, pinky2, pinky3]);

            expect(res).toEqual(['resolve', 'resolve', 'resolve']);
            expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(1+1); // 1 for the Pinky itself and 1 for the 'all'
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
            expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1+1);
            expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1+1);
        });

        test('all promises are resolved and NOT succeeded but SUCCEEDS in the retries', async () => {
            let counter = 1;
            const pinky1 = new index.PinkyPromise(
                (resolve, reject) => {
                    counter++
                    resolve('resolve');
                },
                {
                    success: () => counter === 3,
                    revert: () => true,
                }
            );
            const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
            const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');

            const pinky2 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

            const pinky3 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');


            const res = await index.PinkyPromise.all([pinky1, pinky2, pinky3]);

            expect(res).toEqual(['resolve', 'resolve', 'resolve']);
            expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(2 + 1); // 2 for the Pinky itself and 1 for the 'all'
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
            expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1 + 1); // 1 for the Pinky itself and 1 for the 'all'
            expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1 + 1);
        });

        test('all promises are resolved and but even if ONE FAILS then all revert', async () => {
            let counter = 1;
            const pinky1 = new index.PinkyPromise(
                (resolve, reject) => {
                    counter++
                    resolve('resolve');
                },
                {
                    success: () => counter === 3,
                    revert: function() {
                        return true;
                    },
                }
            );
            const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
            const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');

            const pinky2 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => false,
                    revert: function() {
                        return true;
                    },
                }
            );
            const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');
            const _pinky2RevertSpy = sinon.spy(pinky2['_config'], 'revert');

            const pinky3 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revert: function() {
                        return true;
                    },
                }
            );
            const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');
            const _pinky3RevertSpy = sinon.spy(pinky3['_config'], 'revert');

            try {
                await index.PinkyPromise.all([pinky1, pinky2, pinky3]);
                expect(true).toBe(false);
            } catch (e) {
                expect(e instanceof index.PromiseFailedAndReverted).toBe(true);
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
            }
        });

        test('all promises are resolved but one fails and the other succeeds but 1 of the reverts fail', async () => {
            let counter = 1;
            const pinky1 = new index.PinkyPromise(
                (resolve, reject) => {
                    counter++
                    resolve('resolve');
                },
                {
                    success: () => counter === 3,
                    revert: function() {
                        return true;
                    },
                }
            );
            const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
            const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');

            const pinky2 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => false,
                    revert: function() {
                        return true;
                    },
                }
            );
            const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');
            const _pinky2RevertSpy = sinon.spy(pinky2['_config'], 'revert');
            
            const pinky3 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revert: function() {
                        return false;
                    },
                }
            );
            const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');
            const _pinky3RevertSpy = sinon.spy(pinky3['_config'], 'revert');

            try {
                await index.PinkyPromise.all([pinky1, pinky2, pinky3]);
                expect(true).toBe(false);
            } catch (e) {
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(5);
                expect(e instanceof index.FatalErrorNotReverted).toEqual(true);
            }
        });

        test('all promises are resolved but one fails and the other succeeds but 1 of the reverts THROWS', async () => {
            let counter = 1;
            const pinky1 = new index.PinkyPromise(
                (resolve, reject) => {
                    counter++
                    resolve('resolve');
                },
                {
                    success: () => counter === 3,
                    revert: function() {
                        return true;
                    },
                }
            );
            const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
            const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');

            const pinky2 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => false,
                    revert: function() {
                        return true;
                    },
                }
            );
            const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');
            const _pinky2RevertSpy = sinon.spy(pinky2['_config'], 'revert');
            
            const pinky3 = new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revert: function() {
                        throw new Error('test');
                    },
                }
            );
            const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');
            const _pinky3RevertSpy = sinon.spy(pinky3['_config'], 'revert');

            try {
                await index.PinkyPromise.all([pinky1, pinky2, pinky3]);
                expect(true).toBe(false);
            } catch (e) {
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect(e instanceof index.FatalErrorNotReverted).toEqual(true);
            }
        });
        
        describe('The same but sequentially - tests flows and not order of execution', () => {
            test('all promises are resolved and succeeded', async () => {
                const pinky1 = new index.PinkyPromise(
                    (resolve, reject) => {
                        resolve('resolve');
                    },
                    {
                        success: () => true,
                        revert: () => false,
                    }
                );
                const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
                const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');
    
                const pinky2 = new index.PinkyPromise(
                    (resolve, reject) => {
                        resolve('resolve');
                    },
                    {
                        success: () => true,
                        revertOnFailure: false,
                    }
                );
                const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');
    
                const pinky3 = new index.PinkyPromise(
                    (resolve, reject) => {
                        resolve('resolve');
                    },
                    {
                        success: () => true,
                        revertOnFailure: false,
                    }
                );
                const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');
    
                const res = await index.PinkyPromise.allSeq([pinky1, pinky2, pinky3]);
    
                expect(res).toEqual(['resolve', 'resolve', 'resolve']);
                expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(1+1); // 1 for the Pinky itself and 1 for the 'all'
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
                expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1+1);
                expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1+1);
            });
    
            test('all promises are resolved and NOT succeeded but SUCCEEDS in the retries', async () => {
                let counter = 1;
                const pinky1 = new index.PinkyPromise(
                    (resolve, reject) => {
                        counter++
                        resolve('resolve');
                    },
                    {
                        success: () => counter === 3,
                        revert: () => true,
                    }
                );
                const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
                const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');
    
                const pinky2 = new index.PinkyPromise(
                    (resolve, reject) => {
                        resolve('resolve');
                    },
                    {
                        success: () => true,
                        revertOnFailure: false,
                    }
                );
                const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');
    
                const pinky3 = new index.PinkyPromise(
                    (resolve, reject) => {
                        resolve('resolve');
                    },
                    {
                        success: () => true,
                        revertOnFailure: false,
                    }
                );
                const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');
    
    
                const res = await index.PinkyPromise.allSeq([pinky1, pinky2, pinky3]);
    
                expect(res).toEqual(['resolve', 'resolve', 'resolve']);
                expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(2 + 1); // 2 for the Pinky itself and 1 for the 'all'
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
                expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1 + 1); // 1 for the Pinky itself and 1 for the 'all'
                expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1 + 1);
            });
    
            test('all promises are resolved and but even if ONE FAILS then all revert', async () => {
                let counter = 1;
                const pinky1 = new index.PinkyPromise(
                    (resolve, reject) => {
                        counter++
                        resolve('resolve');
                    },
                    {
                        success: () => counter === 3,
                        revert: function() {
                            return true;
                        },
                    }
                );
                const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
                const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');
    
                const pinky2 = new index.PinkyPromise(
                    (resolve, reject) => {
                        resolve('resolve');
                    },
                    {
                        success: () => false,
                        revert: function() {
                            return true;
                        },
                    }
                );
                const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');
                const _pinky2RevertSpy = sinon.spy(pinky2['_config'], 'revert');
    
                const pinky3 = new index.PinkyPromise(
                    (resolve, reject) => {
                        resolve('resolve');
                    },
                    {
                        success: () => true,
                        revert: function() {
                            return true;
                        },
                    }
                );
                const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');
                const _pinky3RevertSpy = sinon.spy(pinky3['_config'], 'revert');
    
                try {
                    await index.PinkyPromise.allSeq([pinky1, pinky2, pinky3]);
                    expect(true).toBe(false);
                } catch (e) {
                    expect(e instanceof index.PromiseFailedAndReverted).toBe(true);
                    expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
                    expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
                    expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
                }
            });
        });
    });
});

// TODO .then .catch .finally flows
