import sinon from 'sinon';
import { errors, PinkyPromise } from '../../src';
PinkyPromise.config();

describe('Group of pinky promises flows:', () => {
    test('all promises are resolved and succeeded', async () => {
        const pinky1 = new PinkyPromise(
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

        const pinky2 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => true,
                revertOnFailure: false,
            }
        );
        const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

        const pinky3 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => true,
                revertOnFailure: false,
            }
        );
        const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');

        const res = await PinkyPromise.all([pinky1, pinky2, pinky3]);

        expect(res).toEqual(['resolve', 'resolve', 'resolve']);
        expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(1+1); // 1 for the Pinky itself and 1 for the 'all'
        expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
        expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1+1);
        expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1+1);
    });

    test('all promises are resolved and NOT succeeded but SUCCEEDS in the retries', async () => {
        let counter = 1;
        const pinky1 = new PinkyPromise(
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

        const pinky2 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => true,
                revertOnFailure: false,
            }
        );
        const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

        const pinky3 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => true,
                revertOnFailure: false,
            }
        );
        const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');


        const res = await PinkyPromise.all([pinky1, pinky2, pinky3]);

        expect(res).toEqual(['resolve', 'resolve', 'resolve']);
        expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(2 + 1); // 2 for the Pinky itself and 1 for the 'all'
        expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
        expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1 + 1); // 1 for the Pinky itself and 1 for the 'all'
        expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1 + 1);
    });

    test('all promises are resolved and but even if ONE FAILS then all revert', async () => {
        let counter = 1;
        const pinky1 = new PinkyPromise(
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

        const pinky2 = new PinkyPromise(
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

        const pinky3 = new PinkyPromise(
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
            await PinkyPromise.all([pinky1, pinky2, pinky3]);
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
        }
    });

    test('all promises are resolved but one fails and the other succeeds but 1 of the reverts fail', async () => {
        let counter = 1;
        const pinky1 = new PinkyPromise(
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

        const pinky2 = new PinkyPromise(
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
        
        const pinky3 = new PinkyPromise(
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
            await PinkyPromise.all([pinky1, pinky2, pinky3]);
            expect(true).toBe(false);
        } catch (e) {
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(5);
            expect(e instanceof errors.FatalErrorNotReverted).toEqual(true);
        }
    });

    test('all promises are resolved but one fails and the other succeeds but 1 of the reverts THROWS', async () => {
        let counter = 1;
        const pinky1 = new PinkyPromise(
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

        const pinky2 = new PinkyPromise(
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
        
        const pinky3 = new PinkyPromise(
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
            await PinkyPromise.all([pinky1, pinky2, pinky3]);
            expect(true).toBe(false);
        } catch (e) {
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect(e instanceof errors.FatalErrorNotReverted).toEqual(true);
        }
    });

    test('one of the promises fail but the other is configured "isRetryable": false', async () => {
        const pinky1 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: function() {
                    return true;
                },
                isRetryable: false,
            }
        );
        const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
        const _pinky1RetrySpy = sinon.spy(pinky1, '_retry');
        const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');

        const pinky2 = new PinkyPromise(
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
        const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');
        const _pinky2RevertSpy = sinon.spy(pinky2['_config'], 'revert');

        try {
            await PinkyPromise.all([pinky1, pinky2]);
            expect(true).toBe(false);
        } catch (e) {
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky1['_retry'] as sinon.Spy).callCount).toBe(0);
            expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(1);
            expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect(e instanceof errors.PromiseFailedAndReverted).toEqual(true);
        }
    });

    test('one of the promises fail but the other is configured "revertOnFailure": false', async () => {
        const pinky1 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: function() {
                    return true;
                }
            }
        );
        const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
        const _pinky1RetrySpy = sinon.spy(pinky1, '_retry');
        const _pinky1RevertSpy = sinon.spy(pinky1['_config'], 'revert');

        const pinky2 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => true,
                revertOnFailure: false,
            }
        );
        const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

        try {
            await PinkyPromise.all([pinky1, pinky2]);
            expect(true).toBe(false);
        } catch (e) {
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
            expect((pinky1['_retry'] as sinon.Spy).callCount).toBe(5);
            expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(6);
            expect(e instanceof errors.PromiseFailedAndReverted).toEqual(true);
        }
    });

    test('one of the promises fail but both are configured "revertOnFailure": false', async () => {
        const pinky1 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revertOnFailure: false,
            }
        );
        const _pinky1SuccessSpy = sinon.spy(pinky1['_config'], 'success');
        const _pinky1RetrySpy = sinon.spy(pinky1, '_retry');

        const pinky2 = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => true,
                revertOnFailure: false,
            }
        );
        const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

        try {
            await PinkyPromise.all([pinky1, pinky2]);
            expect(true).toBe(false);
        } catch (e) {
            expect((pinky1['_retry'] as sinon.Spy).callCount).toBe(5);
            expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(6);
            expect(e instanceof errors.PromiseFailed).toEqual(true);
        }
    });
    
    describe('The same but sequentially - tests flows and not order of execution', () => {
        test('all promises are resolved and succeeded', async () => {
            const pinky1 = new PinkyPromise(
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

            const pinky2 = new PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

            const pinky3 = new PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');

            const res = await PinkyPromise.allSeq([pinky1, pinky2, pinky3]);

            expect(res).toEqual(['resolve', 'resolve', 'resolve']);
            expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(1+1); // 1 for the Pinky itself and 1 for the 'all'
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
            expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1+1);
            expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1+1);
        });

        test('all promises are resolved and NOT succeeded but SUCCEEDS in the retries', async () => {
            let counter = 1;
            const pinky1 = new PinkyPromise(
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

            const pinky2 = new PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky2SuccessSpy = sinon.spy(pinky2['_config'], 'success');

            const pinky3 = new PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => true,
                    revertOnFailure: false,
                }
            );
            const _pinky3SuccessSpy = sinon.spy(pinky3['_config'], 'success');


            const res = await PinkyPromise.allSeq([pinky1, pinky2, pinky3]);

            expect(res).toEqual(['resolve', 'resolve', 'resolve']);
            expect((pinky1['_config'].success as sinon.Spy).callCount).toBe(2 + 1); // 2 for the Pinky itself and 1 for the 'all'
            expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(0);
            expect((pinky2['_config'].success as sinon.Spy).callCount).toBe(1 + 1); // 1 for the Pinky itself and 1 for the 'all'
            expect((pinky3['_config'].success as sinon.Spy).callCount).toBe(1 + 1);
        });

        test('all promises are resolved and but even if ONE FAILS then all revert', async () => {
            let counter = 1;
            const pinky1 = new PinkyPromise(
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

            const pinky2 = new PinkyPromise(
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

            const pinky3 = new PinkyPromise(
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
                await PinkyPromise.allSeq([pinky1, pinky2, pinky3]);
                expect(true).toBe(false);
            } catch (e) {
                expect(e instanceof errors.PromiseFailedAndReverted).toBe(true);
                expect((pinky1['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky2['_config'].revert as sinon.Spy).callCount).toBe(1);
                expect((pinky3['_config'].revert as sinon.Spy).callCount).toBe(1);
            }
        });
    });
});
