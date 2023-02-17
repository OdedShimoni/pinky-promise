interface IClean {
    isRetryable: boolean;
    isSuccess: () => boolean; // consider changing to a bool if needed, default is: success = promise resolved
    // ... will be defined after testing some dynamic shit
}

class Clean<T> extends Promise<T> {
    isRetryable: boolean;
    isSuccess: Function;
    revert: Function;
    _resolvedValue: T;
    then: any;
    constructor(executor, options) {
        const rawExecutor = executor;
        const rescue = (onfulfilled, onrejected) => {
                if (this.revert) {
                const reverted = this.revert();
                if (reverted) {
                    onrejected('Reverted');
                }
            }
        };

        const wrapperThen = (onfulfilled, onrejected) => {
            const originalOnRejected = onrejected;
            onrejected = (e) => {
                originalOnRejected(e);
                rescue(onfulfilled, originalOnRejected);
            }
        };

        super(executor);
        this.then = wrapperThen;
        const isBeforeAwaiting = !!options; // terrible name + not sure is correct nor best practice
        const isAfterAwaiting = !options; // teririble name + not sure is correct nor best practice
        if (isBeforeAwaiting) {
            this.revert = options.revert;
            this.isSuccess = options.isSuccess;
        }
    }
}

(async function() {

    let variable = 0;

    const addOne = new Clean(
        (resolve, reject) => {
            this.meta = this.meta || {};
            this.meta.originalValue = variable;

            const randBool = Math.random() > 0.5;
            const toReject = randBool;

            ++variable;
            if (toReject) {
                reject('Couldn\'t do action');
            } else {
                resolve();
            }
        },
        {
            revert: () => {
                variable = this.meta.originalValue;
            },
            isSuccess: () => true, // temp
        }
    );

    try {
        const res = await addOne;
        console.log(variable);
    } catch (e) {
        console.log(variable);
    }
})();
