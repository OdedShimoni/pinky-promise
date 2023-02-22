interface IClean {
    isRetryable: boolean;
    isSuccess: () => boolean;

    // consider changing to a bool if needed, default is: success = promise resolved
    // ... will be defined after testing some dynamic shit
}

interface CleanConfig {
    isRetryable?: boolean;
    isSuccess: () => boolean;
    revert?: Function;
    isRevertable?: boolean;
    maxRetryAttempts?: number;
}

class Clean<TT> implements PromiseLike<TT> {
    config: CleanConfig;
    rescue: Function;
    innerPromise;
    retryAttemptsCount: number = 0;
    then = function(onfulfilled, onrejected) {
        // im trying to find out where inner promise is being 'thened'
        return new Promise(async (resolve, reject) => {
            // here the Clean resolves or rejects, regardless of the inner promise
            try {
                const originalPromiseValue: TT = await this.innerPromise;
                if (!this.isSuccess(originalPromiseValue)) {
                        console.log('rescuing')
                        if (!this.rescue()) {
                            await onrejected(); 
                            reject('Clean rejected...');
                            return;
                        }
                    }
                    await onfulfilled(); // probably wrong usage, if 'then' would have the PromiseLike.then types, I believe it would type error me
                    resolve(originalPromiseValue);
            } catch (e) {
                await onrejected(); 
                console.error('inner promise rejected.');
                console.error(e);
            }
        });
    };
    constructor(executor, config: CleanConfig) {
        if (!config?.revert && config?.isRevertable !== false) {
            throw new Error('Clean must either have a revert method or explicitly state it is irevertable.');
        }

        const innerPromise = new Promise(executor);
        this.innerPromise = innerPromise;
        config && (this.config = config);

        // default values
        this.config.isRetryable = this.config?.isRetryable ?? false;
        this.config.maxRetryAttempts = this.config?.maxRetryAttempts ?? 5;

        this.rescue = function() {
            const shouldRetry = this.config.isRetryable && this.config.retryAttemptsCount < this.config.maxRetryAttempts;
            if (shouldRetry) {
                // try again somehow
                return; // return something for short circuit
            }
            const shouldRevert = this.config.revert;
            if (shouldRevert) {
                return this.config.revert();
            }
        }
    }
}

(async function() {

    const originalValue = 0;
    let variable = 0;

    const addOne = new Clean(
        (resolve, reject) => {
            const toReject = false;

            ++variable;
            // ++variable; // temp to fail isSuccess
            if (toReject) {
                reject('Couldn\'t do action');
            } else {
                resolve('yay');
            }
        },
        {
            revert: () => {
                variable = originalValue;
            },
            isSuccess: function() {
                return variable === 1;
            },
        }
    );

    // const anotherAsyncAction = new Clean((resolve, reject) => {
    //     resolve('lol');
    // },
    // {
    //     isSuccess: function(promiseResolvedValue) {
    //         return promiseResolvedValue === 'lol';
    //     }
    // });

    // addOne.then(value => console.log(`what value is this? value: ${value}`), error => console.warn('lol this is inner promise onrejected'))
    // .catch(e => console.error(`Clean rejected, Error: '${e}'. How can I do it with async await?`));

    try {
        const value = await addOne;
        console.log(`what value is this? value: ${value}`);
    } catch (e) {
        console.error(`Clean rejected, Error: '${e}'. How can I do it with async await?`);
    }
})();
