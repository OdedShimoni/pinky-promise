import { errors, PinkyPromise } from '../src';

describe('Configuration tests', () => {
    it('should throw if user tries to use PinkyPromise before configuration', async () => {
        try {
            new PinkyPromise(
                (resolve, reject) => {
                    resolve('resolve');
                },
                {
                    success: () => false,
                }
            );
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.ProgrammerError).toBe(true);
        }
    });

    it('should throw if user tries to configure PinkyPromise twice', async () => {
        try {
            PinkyPromise.config();
            PinkyPromise.config();
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.ProgrammerError).toBe(true);
        }
    });

    it('should throw if user tries to configure PinkyPromise 3 times', async () => {
        try {
            PinkyPromise.config();
            PinkyPromise.config();
            PinkyPromise.config();
            expect(true).toBe(false);
        } catch (e) {
            expect(e instanceof errors.ProgrammerError).toBe(true);
        }
    });
});
