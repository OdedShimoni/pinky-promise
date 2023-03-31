import * as index from '../src';
index.PinkyPromise.config();

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
