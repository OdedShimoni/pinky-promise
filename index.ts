import { v4 as uuidv4 } from 'uuid';

interface CleanGroupContext {
    id: string;
    cleans: Clean<any>[];
}
interface CleanConfig<T> {
    isRetryable?: boolean;
    successDefinition: (innerPromiseReturn?: T) => boolean; // shouldn't be called before _innerPromise is resolved. TODO write a restriction to not allow it and write a test for it
    revert?: Function;
    revertOnFailure?: boolean;
    maxRetryAttempts?: number;
    logger?: ILogger; // TODO get logger from global config file, since it is single for all Clean instances
    verbose?: boolean; // TODO get logger from global config file, since it is single for all Clean instances
}

interface ILogger {
    log: Function;
    error: Function;
    warn: Function;
    info: Function;
}

// TODO test this + write unit test
const allPropertiesAreEmptyFunctions: any = new Proxy({}, {
    get: function(_target, _prop) {
        return () => {};
    }
});

class Clean<TT> implements PromiseLike<TT> {
    private _id: string;
    private _config: CleanConfig<TT>;
    private _rescue: Function;
    private _innerPromise: PromiseLike<TT>;
    private _retryAttemptsCount: number = 0;
    groupContext?: CleanGroupContext;
    // I changed type of 'then' method to return 'Promise' instead of 'PromiseLike' so we can use 'catch' method when working with 'then' function instead of 'await'
    then: <TResult1 = TT, TResult2 = never>(onfulfilled?: ((value: TT) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null) => Promise<TResult1 | TResult2> = function(onfulfilled, onrejected) {
        return new Promise(async <TResult1 = TT, TResult2 = never>(resolve: (value: TResult1 | TResult2 | PromiseLike<TResult1 | TResult2>) => void, reject: (reason?: any) => void) => {
            // here the Clean resolves or rejects, regardless of the inner promise
            try {
                const innerPromiseReturn: TT = await this._innerPromise;
                if (!this._config.successDefinition(innerPromiseReturn)) {
                    if (!await this._rescue()) {
                        await onrejected(`Clean with id: ${this._id} rescue failed.`); 
                        // reject(`Clean with id: ${this._id} rescue failed.`);
                        return;
                    }
                }
                await onfulfilled(innerPromiseReturn);
                resolve(innerPromiseReturn as unknown as TResult1);
            } catch (innerPromiseError) {
                await onrejected(innerPromiseError); 
                // reject(`Clean with id: ${this._id} inner promise error. ${innerPromiseError}`);
                this._config.verbose && (this._config.logger.error(`Clean with id: ${this._id} inner promise error. ${innerPromiseError}`));
            }
        });
    };
    constructor(executor: (resolve: (value: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void, config: CleanConfig<TT>) {
        if (!config?.revert && config?.revertOnFailure !== false) {
            throw new Error(`${this.constructor.name} must either have a revert method or explicitly state don't revert on error with revertOnFailure: false.`);
        }

        this._id = uuidv4();

        const _innerPromise = new Promise<TT>(executor);
        this._innerPromise = _innerPromise;

        config && (this._config = config);
        // default values
        this._config.isRetryable = this._config?.isRetryable ?? false;
        this._config.verbose = this._config?.verbose ?? false;
        this._config.maxRetryAttempts = this._config?.maxRetryAttempts ?? 5;
        this._config.logger = config?.logger ?? allPropertiesAreEmptyFunctions;

        this._config.verbose && (this._config.logger.log(`Clean created with id: ${this._id}`, this)); // temp commentation because it is too verbose // ? if I can log the code itself of the executor, it would be easier to understand which Clean this is

        // TODO if a Clean is being 'Clean.all'ed then 'revert' might be called twice: once at the Promise.all at Clean.all method (currently line 76), which calls 'this.then' method
        // TODO and once in 'Clean.all's revert. I don't want the dev to have to make 'revert' idempotent, let's try and make 'revert' be called only once per Clean.
        this._rescue = async function(groupFlag = false) {
            this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is being rescued...`));
            const shouldRetry = this._config.isRetryable && this._config._retryAttemptsCount < this._config.maxRetryAttempts;
            if (shouldRetry) {
                this._retryAttemptsCount++;
                this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is being retried for the ${this._retryAttemptsCount} time...`));
                // return await this; // TODO TESTTT and write unit test
            }
            if (this._config.revertOnFailure === false) { // consider adding || !this._config.revert or even just !this._config.revert
                this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is not being reverted because revertOnFailure is set to false, returning true.`));
                return true;
            }

            const isPartOfAGroup = !!this.groupContext;
            if (isPartOfAGroup && !groupFlag) {
                this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} needs to be reverted and is part of a group, skipping revert inside Clean and leaving it to happen as part of the group.`));
                return true;
            }

            if (!!this._config.revert) {
                this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is being reverted...`));
                try {
                    const revertResult = await this._config.revert();
                    if (revertResult !== false) { // to allow the user stating revert failure if explicitly returning false from revert function. if revert failure fails then whole Clean should reject
                        // TODO write unit test for the above comment's functionality
                        this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} was reverted successfully, returning true.`));
                        return true;
                    }
                } catch (revertError) {
                    this._config.logger.error(`Clean with id: ${this._id} failed to revert.`, revertError); // TODO test that 'revertError' is being inserted correctly and not [object Object]
                    return;
                }
            }
            throw new Error('Something unexpected happened in ' + this.constructor.name + ': _rescue unintendedly did nothing.');
        }
    }

    static async all<T>(cleans: (Clean<T>)[]): Promise<T[] | void> {
        const id = uuidv4();

        const verbose = true; // temp, get from global config when available
        const logger = console; // temp, get from global config when available
        verbose && (console.log(`Clean.all with id: ${id} is being executed...`));
        function _rescueAll() {
            try {
                const reversedCleans = cleans.reverse(); // should I work on a pollyfill to make it work on older node versions? I don't think so, if they wanna use Clean let them update
                // ? should it be sync (for in)? or async(forEach)? maybe something else? perhaps user will be able to config either sync or async execution
                
                reversedCleans.forEach(clean => clean._config.revertOnFailure !== false ? clean._rescue(true) : true);
                // for (const clean of reversedCleans) {
                //     clean._config.revertOnFailure !== false ? await clean._rescue(true) : true;
                // }
            } catch (revertError) {
                logger.error(`Clean.all with id:${id} revert error! ${revertError}`);
            }
        }
        // if any of 'cleans' reject, call '_rescue' on all of them:
        try {
            // fk sync code, can I do it in a smarter way? at least work with event loop and not against it
            for (const clean of cleans) {
                clean.groupContext = {
                    id,
                    cleans,
                };
            }
            const cleanResults = await Promise.all(cleans);
            const cleanSuccesses = cleans.map((clean, i) => clean._config.successDefinition(cleanResults[i])); // TODO test this I'm so tired now lol and consider writing unit test
            if (cleanSuccesses.some(cleanSuccess => !cleanSuccess)) {
                _rescueAll();
            } else {
                return cleanResults;
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
            // ++variable; // temp to fail successDefinition
            // ++variable; // temp to fail successDefinition
            // ++variable; // temp to fail successDefinition
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
            successDefinition: () => variable === 1,
            // successDefinition: () => false,
            logger: console,
            verbose: true,
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
        successDefinition: function(promiseResolvedValue) {
            return promiseResolvedValue === 'lol 😎';
        },
        revertOnFailure: false,
        logger: console,
        verbose: true,
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
        successDefinition: function(promiseResolvedValue) {
            // return promiseResolvedValue === 'lol 😎 3rd';
            return false; // temp to fail
        },
        revert: () => {
            // throw new Error('revert error LOLL');
            console.log('reverted 3rd');
        },
        logger: console,
        verbose: true,
    });

    const fourthAsyncAction = new Clean<string>((resolve, reject) => {
        const rejectThis = false;
        if (rejectThis) {
            reject('reject 🙁 4th');
        } else {
            resolve('lol 😎 4th');
        }
    },
    {
        successDefinition: function(promiseResolvedValue) {
            return promiseResolvedValue === 'lol 😎 4th';
            // return false; // temp to fail
        },
        revert: () => {
            console.log('reverted 4th');
        },
        logger: console,
        verbose: true,
    });

    try {
        // console.log(await addOne);
        console.log(await Clean.all([addOne, anotherAsyncAction, thirdAsyncAction, fourthAsyncAction]));
        // debugger;
    } catch (e) {
        console.error(`Clean rejected, Error: '${e}'.`);
    }
})();

// TODO write test that when Clean runs in a group then all cleans receive a groupContext and when run alone it is empty
