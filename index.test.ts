import sinon from 'sinon';
import * as index from '.';
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
});

describe('Pinky Promise flow tests', () => {

    describe('Inner promise resolves flows:', () => {
        test('the flow where promise is resolved and succeeded at the first time', async () => {
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

        test('the flow where promise is resolved and NOT succeeded but succeeds in the retries', async () => {
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

        test('the flow where promise is resolved and NOT succeeded but EXCEEDS number of retries and SUCCEEDS in the reverts', async () => {
            let counter = 1;
            const pinky = new index.PinkyPromise(
                (resolve, reject) => {
                    counter++;
                    resolve('resolve');
                },
                {
                    success: () => false,
                    revert: function() {
                        return counter === 7
                    }
                }
            );

            const _pinkySuccessSpy = sinon.spy(pinky['_config'], 'success');
            const _pinkyRevertSpy = sinon.spy(pinky['_config'], 'revert');

            const res = await pinky;

            expect(res).toBe('resolve');
            expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6); // 1 for the first time and 5 for the retries
            expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
        });

        test('the flow where promise is resolved and NOT succeeded but EXCEEDS number of retries and NOT succeeded in the reverts', async () => {
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
            }
            catch (e) {
                expect(e instanceof index.FatalErrorNotReverted).toBe(true);
                expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6); // 1 for the first time and 5 for the retries
                expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(5);
            }
        });

        test('the flow where an error is thrown inside "success"', async () => {
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
            }
            catch (e) {
                expect(e instanceof index.FatalErrorNotReverted).toBe(true);
                expect((pinky['_config'].success as sinon.Spy).callCount).toBe(1);
                expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(0);
            }
        });

        test('the flow where promise is resolve and NOT succeeded but EXCEEDS number of retries and revert THROWS an error', async () => {
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
            }
            catch (e) {
                expect(e instanceof index.FatalErrorNotReverted).toBe(true);
                expect((pinky['_config'].success as sinon.Spy).callCount).toBe(6); // 1 for the first time and 5 for the retries
                expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(1);
            }
        });


        test('the flow where pinky promise sets different number of retries and reverts', async () => {
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
            }
            catch (e) {
                expect(e instanceof index.FatalErrorNotReverted).toBe(true);
                expect((pinky['_config'].success as sinon.Spy).callCount).toBe(11); // 1 for the first time and 10 for the retries
                expect((pinky['_config'].revert as sinon.Spy).callCount).toBe(20);
            }
        });
    });

    describe('Inner promise rejects flows:', () => {
        it.todo('the flow where promise is rejected succeeds in the retries');
    });


    describe('Group of pinky promises flows:', () => {
        test('the flow where all promises are resolved and succeeded', async () => {
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

        test('the flow where all promises are resolved and NOT succeeded but SUCCEEDS in the retries', async () => {
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

        test('the flow where all promises are resolved and but even if ONE FAILS then all revert', async () => {
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

            await index.PinkyPromise.all([pinky1, pinky2, pinky3]);

            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
        });
        describe('The same but sequentially - tests flows and not order of execution', () => {
            test('the flow where all promises are resolved and succeeded', async () => {
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
    
                const res = await index.PinkyPromise.all([pinky1, pinky2, pinky3], true);
    
                expect(res).toEqual(['resolve', 'resolve', 'resolve']);
                expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(1+1); // 1 for the Pinky itself and 1 for the 'all'
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
                expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1+1);
                expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1+1);
            });
    
            test('the flow where all promises are resolved and NOT succeeded but SUCCEEDS in the retries', async () => {
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
    
    
                const res = await index.PinkyPromise.all([pinky1, pinky2, pinky3], true);
    
                expect(res).toEqual(['resolve', 'resolve', 'resolve']);
                expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(2 + 1); // 2 for the Pinky itself and 1 for the 'all'
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
                expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1 + 1); // 1 for the Pinky itself and 1 for the 'all'
                expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1 + 1);
            });
    
            test('the flow where all promises are resolved and but even if ONE FAILS then all revert', async () => {
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
    
                await index.PinkyPromise.all([pinky1, pinky2, pinky3], true);
    
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
            });
        });
    });
});

// TODO .then .catch .finally flows
