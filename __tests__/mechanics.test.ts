import * as sinon from "sinon";
import { errors, PinkyPromise } from "../src";
PinkyPromise.config();

describe('Pinky Promise mechanics tests', () => {
    it('should throw "FatalErrorNotReverted" if revert is attempted and the function returns explicit "false" in all its attempts', async () => {
        const pinky = new PinkyPromise(
            (resolve, reject) => {
                resolve('resolve');
            },
            {
                success: () => false,
                revert: () => false,
            }
        );

        const _revertSpy = sinon.spy(pinky, '_revert');

        try {
            await pinky;
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.FatalErrorNotReverted).toBe(true);
            expect(_revertSpy.callCount).toBe(5);
        }
    });

    it('should throw "ProgrammerError" if user sets "isRetryable" to "false" and "revertOnFailure" to "false"', async () => {
        try {
            const pinky = new PinkyPromise(
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
            expect(e instanceof errors.ProgrammerError).toBe(true);
        }
    });

    it('should throw "ProgrammerError" when user sets "revertOnFailure" to "false" and sets revert method', async () => {
        try {
            new PinkyPromise(
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
            expect(e instanceof errors.ProgrammerError).toBe(true);
        }
    });
});
