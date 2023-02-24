interface CleanConfig<T> {
    isRetryable?: boolean;
    isSuccess: (innerPromiseReturn?: T) => boolean; // shouldn't be called before _innerPromise is resolved. TODO write a restriction to not allow it and write a test for it
    revert?: Function;
    revertOnError?: boolean;
    maxRetryAttempts?: number;
    log?: boolean;
}

interface ILogger {
    log: Function;
    error: Function;
    warn: Function;
    info: Function;
}

class Clean<TT> implements PromiseLike<TT> {
    private _config: CleanConfig<TT>;
    private _rescue: Function;
    private _innerPromise: PromiseLike<TT>;
    private _retryAttemptsCount: number = 0;
    private _logger: ILogger;
    // I changed type of 'then' method to return 'Promise' instead of 'PromiseLike' so we can use 'catch' method when working with 'then' function instead of 'await'
    then: <TResult1 = TT, TResult2 = never>(onfulfilled?: ((value: TT) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null) => Promise<TResult1 | TResult2> = function(onfulfilled, onrejected) {
        return new Promise(async <TResult1 = TT, TResult2 = never>(resolve: (value: TResult1 | TResult2 | PromiseLike<TResult1 | TResult2>) => void, reject: (reason?: any) => void) => {
            // here the Clean resolves or rejects, regardless of the inner promise
            try {
                const innerPromiseReturn: TT = await this._innerPromise;
                if (!this._config.isSuccess(innerPromiseReturn)) {
                        if (!await this._rescue()) {
                            await onrejected('reason...'); 
                            reject('Clean rejected...');
                            return;
                        }
                    }
                    await onfulfilled(innerPromiseReturn);
                    resolve(innerPromiseReturn as unknown as TResult1);
            } catch (innerPromiseError) {
                await onrejected(innerPromiseError); 
                console.error('inner promise rejected.');
                console.error(innerPromiseError);
            }
        });
    };
    constructor(executor: (resolve: (value: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void, config: CleanConfig<TT>, logger?: ILogger) {
        if (!config?.revert && config?.revertOnError !== false) {
            throw new Error(`${this.constructor.name} must either have a revert method or explicitly state don't revert on error with revertOnError: false.`);
        }

        const _innerPromise = new Promise<TT>(executor);
        this._innerPromise = _innerPromise;

        config && (this._config = config);
        // default values
        this._config.isRetryable = this._config?.isRetryable ?? false;
        this._config.maxRetryAttempts = this._config?.maxRetryAttempts ?? 5;
        this._config.log = this._config?.log ?? false;

        // log only if config.log is true
        if (logger) {
            this._logger = new Proxy(logger, {
                get: function(target, prop) {
                    if (this._config.log) {
                        return target?.[prop];
                    }
                    return () => {};
                }
            });
        }

        // TODO if a Clean is being 'Clean.all'ed then 'revert' might be called twice: once at the Promise.all at Clean.all method (currently line 76), which calls 'this.then' method
        // TODO and once in 'Clean.all's revert. I don't want the dev to have to make 'revert' idempotent, let's try and make 'revert' be called only once per Clean.
        this._rescue = async function() {
            this._logger.log('rescue called');
            const shouldRetry = this._config.isRetryable && this._config._retryAttemptsCount < this._config.maxRetryAttempts;
            if (shouldRetry) {
                // try again somehow
                return; // return something for short circuit
            }
            if (this._config.revertOnError === false) {
                return true;
            }
            const shouldRevert = this._config.revert;
            if (shouldRevert) {
                try {
                    const revertResult = await this._config.revert();
                    if (revertResult !== false) { // to allow the user stating revert failure if explicitly returning false from revert function. if revert failure fails then whole Clean should reject
                        // TODO write unit test for the above comment's functionality
                        return true;
                    }
                } catch (revertError) {
                    console.error('revert error');
                    console.error(revertError);
                    return;
                }
            }
            throw new Error('Something unexpected happened in ' + this.constructor.name + ': _rescue unintendedly did nothing.');
        }
    }

    static async all<T>(values: (Clean<T>)[]): Promise<T[] | void> {
        function _rescueAll() {
            try {
                const reversedValues = values.reverse(); // should I work on a pollyfill to make it work on older node versions? I don't think so, if they wanna use Clean let them update
                // ? should it be sync (for in)? or async(forEach)? maybe something else?
                
                reversedValues.forEach(clean => clean._config.revertOnError !== false ? clean._config?.revert() : true);
                // for (const clean of reversedValues) {
                //     clean._config.revertOnError !== false ? await clean._config?.revert() : true;
                // }
            } catch (revertError) {
                console.error(`revert error!!!!!!!!!! ${revertError}`); // test
                throw revertError;
            }
        }
        // if any of 'values' reject, call '_rescue' on all of them:
        try {
            const cleanResults = await Promise.all(values);
            const cleanSuccesses = values.map((clean, i) => clean._config.isSuccess(cleanResults[i])); // TODO test this I'm so tired now lol and consider writing unit test
            if (cleanSuccesses.some(cleanSuccess => !cleanSuccess)) {
                _rescueAll();
            }
        } catch (cleanError) {
            _rescueAll();
        }
    }
}

(async function() {

    const originalValue = 0;
    let variable = 0;

    const addOne = new Clean<string>(
        (resolve, reject) => {
            const toReject = false;

            ++variable;
            ++variable; // temp to fail isSuccess
            ++variable; // temp to fail isSuccess
            ++variable; // temp to fail isSuccess
            if (toReject) {
                reject('Couldn\'t do action');
            } else {
                resolve('yay');
            }
        },
        {
            revert: () => {
                // variable = originalValue;
                --variable;
            },
            isSuccess: () => variable === 1,
            // isSuccess: () => false,
        }
    );

    const anotherAsyncAction = new Clean<string>((resolve, reject) => {
        const rejectThis = false;
        if (rejectThis) {
            reject('reject 🙁');
        } else {
            resolve('lol 😎');
        }
    },
    {
        isSuccess: function(promiseResolvedValue) {
            return promiseResolvedValue === 'lol';
        },
        revertOnError: false
    });

    const thirdAsyncAction = new Clean<string>((resolve, reject) => {
        const rejectThis = false;
        if (rejectThis) {
            reject('reject 🙁 3rd');
        } else {
            resolve('lol 😎 3rd');
        }
    },
    {
        isSuccess: function(promiseResolvedValue) {
            return promiseResolvedValue === 'lol';
        },
        revert: () => {
            console.log('just log I reverted lollll');
        }
    });

    try {
        console.log(await Clean.all([addOne, anotherAsyncAction, thirdAsyncAction]));
        // debugger;
    } catch (e) {
        console.error(`Clean rejected, Error: '${e}'.`);
    }
})();
