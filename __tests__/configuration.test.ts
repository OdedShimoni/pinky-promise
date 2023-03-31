import * as index from '../src';

describe('Configuration tests', () => {
    it('should throw if user tries to use PinkyPromise before configuration', async () => {
        try {
            new index.PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => false,
                }
            );
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof index.ProgrammerError).toBe(true);
        }
    });

    it('should throw if user tries to configure PinkyPromise twice', async () => {
        try {
            index.PinkyPromise.config();
            index.PinkyPromise.config();
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof index.ProgrammerError).toBe(true);
        }
    });

    it('should throw if user tries to configure PinkyPromise 3 times', async () => {
        try {
            index.PinkyPromise.config();
            index.PinkyPromise.config();
            index.PinkyPromise.config();
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof index.ProgrammerError).toBe(true);
        }
    });
});
