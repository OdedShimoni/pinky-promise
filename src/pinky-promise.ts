import { v4 as uuidv4 } from 'uuid';
import { PinkyPromiseGlobalConfig, PinkyPromiseGroupContext, PinkyPromiseUserConfig } from "./contract/pinky-promise.contract";
import { ordinal } from "./ordinal";

// TODO test this + write unit test
const allPropertiesAreEmptyFunctions: any = new Proxy({}, {
    get: function(_target, _prop) {
        return () => {};
    }
});

const defaultGlobalConfig: PinkyPromiseGlobalConfig = {
    logger: allPropertiesAreEmptyFunctions,
    verbose: true,
}

export class PinkyPromise<TT> implements PromiseLike<TT> {
    private static _globalConfig: PinkyPromiseGlobalConfig = defaultGlobalConfig;
    public static config(config: PinkyPromiseGlobalConfig = defaultGlobalConfig) {
        this._globalConfig = config;
    }
    private _id: string;
    private _config: PinkyPromiseUserConfig<TT>;
    private _innerPromiseExecutor: (resolve: (value?: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void;
    private _innerPromiseLastResolvedValue: TT;
    private _attemptsCount: number = 0;
    private _rescue: Function = async function(isExecutedAsPartOfAGroupFlag = false) {
        const { verbose, logger } = PinkyPromise._globalConfig;
        verbose && (logger.log(`PinkyPromise with id: ${this._id} has failed because it has resolved with (${JSON.stringify(this._innerPromiseLastResolvedValue)}) and is beginning fail safe logic...`));
        const retriedSuccessfuly = await this._retry() && await this._config.success(this._innerPromiseLastResolvedValue);
        if (retriedSuccessfuly) {
            verbose && (logger.log(`PinkyPromise with id: ${this._id} was retried successfully, returning true.`));
            return true;
        }
        // for some reason it calls revert for every retry attempt so I patched it:
        const finishedRetries = this._attemptsCount >= this._config.maxRetryAttempts;
        if (finishedRetries) {
            verbose && (logger.log(`PinkyPromise with id: ${this._id} couldn't success even after its retries, reverting...`));
            return this._revert(isExecutedAsPartOfAGroupFlag);
        }
        throw new Error(`Unknown error: PinkyPromise with id: ${this._id} couldn't be rescued.`);
    };
    private _retry = async function() {
        const { verbose, logger } = PinkyPromise._globalConfig;
        
        const needsToBeRetried = this._config.isRetryable && this._attemptsCount < this._config.maxRetryAttempts;
        if (!this._config.isRetryable) {
            verbose && (logger.log(`PinkyPromise with id: ${this._id} is set as not retryable, skipping retry.`));
            return;
        }
        if (this._attemptsCount >= this._config.maxRetryAttempts) {
            verbose && (logger.log(`PinkyPromise with id: ${this._id} has reached max retry attempts, failed retry/s.`));
            return;
        }
        if (needsToBeRetried) {
            this._attemptsCount++;
            verbose && (logger.log(`PinkyPromise with id: ${this._id} is being retried for the ${ordinal(this._attemptsCount)} time...`));
            return await this; // TODO write unit test
        }
    }
    private _revert = async function(isExecutedAsPartOfAGroupFlag = false) {
        const { verbose, logger } = PinkyPromise._globalConfig;

        if (this._config.revertOnFailure === false) { // consider adding || !this._config.revert or even just !this._config.revert
            verbose && (logger.log(`PinkyPromise with id: ${this._id} is not being reverted because revertOnFailure is set to false, returning true.`));
            return true;
        }

        const isPartOfAGroup = !!this.groupContext;
        if (isPartOfAGroup && !isExecutedAsPartOfAGroupFlag) {
            verbose && (logger.log(`PinkyPromise with id: ${this._id} needs to be reverted and is part of a group, skipping revert inside PinkyPromise and leaving it to happen as part of the group.`));
            return true;
        }

        if (!!this._config.revert) {
            verbose && (logger.log(`PinkyPromise with id: ${this._id} is being reverted...`));
            try {
                const revertResult = await this._config.revert();
                if (revertResult !== false) { // to allow the user stating revert failure if explicitly returning false from revert function. if revert failure fails then whole PinkyPromise should reject
                    // TODO write unit test for the above comment's functionality
                    verbose && (logger.log(`PinkyPromise with id: ${this._id} was reverted successfully, returning true.`));
                    return true;
                }
            } catch (revertError) {
                logger.error(`PinkyPromise with id: ${this._id} failed to revert.`, revertError); // TODO test that 'revertError' is being inserted correctly and not [object Object]
                return;
            }
        }
    }
    groupContext?: PinkyPromiseGroupContext;
    // I changed type of 'then' method to return 'Promise' instead of 'PromiseLike' so we can use 'catch' method when working with 'then' function instead of 'await'
    then: <TResult1 = TT, TResult2 = never>(onfulfilled?: ((value: TT) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null) => Promise<TResult1 | TResult2> = function(onfulfilled, onrejected) {
        const { verbose, logger } = PinkyPromise._globalConfig;
        
        return new Promise(async <TResult1 = TT, TResult2 = never>(resolve: (value: TResult1 | TResult2 | PromiseLike<TResult1 | TResult2>) => void, reject: (reason?: any) => void) => {
            // consider thread safety + scope safety for code which an external user writes
            // here the PinkyPromise resolves or rejects, regardless of the inner promise
            try {
                const executor = this._innerPromiseExecutor;
                const innerPromise = new Promise<TT>(executor);
                this._innerPromiseLastResolvedValue = await innerPromise;
                if (!this._config.success(this._innerPromiseLastResolvedValue)) {
                    if (!await this._rescue()) {
                        verbose && (logger.log(`PinkyPromise with id: ${this._id} rescue failed, returning false.`));
                        await onrejected(`PinkyPromise with id: ${this._id} rescue failed.`); 
                        // reject(`PinkyPromise with id: ${this._id} rescue failed.`);
                        return false;
                    }
                }
                // TODO try make these 3 as atomic as possible
                await onfulfilled(this._innerPromiseLastResolvedValue);
                resolve(this._innerPromiseLastResolvedValue as unknown as TResult1);
                return this._innerPromiseLastResolvedValue;
            } catch (innerPromiseError) {
                await onrejected(innerPromiseError); 
                // reject(`PinkyPromise with id: ${this._id} inner promise error. ${innerPromiseError}`); // TODO do I need that?
                verbose && (logger.error(`PinkyPromise with id: ${this._id} inner promise error. ${innerPromiseError}`));
                return false;
            }
        });
    };
    constructor(executor: (resolve: (value: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void, config: PinkyPromiseUserConfig<TT>) {
        if (!config?.revert && config?.revertOnFailure !== false) {
            throw new Error(`${this.constructor.name} must either have a revert method or explicitly state don't revert on error with revertOnFailure: false.`);
        }
        if (!config?.success) {
            throw new Error(`${this.constructor.name} must have a success method to know if it succeeded.`);
        }

        this._id = uuidv4();

        // const _innerPromise = new Promise<TT>(executor);
        this._innerPromiseExecutor = executor;
        // this._innerPromise = _innerPromise;

        config && (this._config = config);
        // default values
        this._config.isRetryable = this._config?.isRetryable ?? true;
        this._config.maxRetryAttempts = this._config?.maxRetryAttempts ?? 5;

        const verbose = PinkyPromise._globalConfig.verbose;
        const logger = PinkyPromise._globalConfig.logger;
        verbose && (logger.log(`PinkyPromise created with id: ${this._id}`, this));
    }

    static async all<T>(cleans: (PinkyPromise<T>)[], isSequential = false): Promise<T[] | void> {
        const id = uuidv4();

        const { verbose, logger } = PinkyPromise._globalConfig; // temp, get from global config when available

        verbose && (logger.log(`PinkyPromise.all with id: ${id} is being executed...`));
        function revertAll() {
            try {
                const reversedPinkyPromises = cleans.reverse();
                // TODO what if revert throws an error? should I catch it and log it?
                reversedPinkyPromises.forEach(clean => clean._config.revertOnFailure !== false ? clean._revert(true) : true);
                // Revert will always be concurrent even if all is sequential, because I can't see a reason to revert sequentially
                // But code is still here if we ever see one:
                // for (const clean of reversedPinkyPromises) {
                //     clean._config.revertOnFailure !== false ? await clean._rescue(true) : true;
                // }
            } catch (revertError) {
                logger.error(`PinkyPromise.all with id:${id} revert error! ${revertError}`);
            }
        }
        // if any of 'cleans' reject, call '_rescue' on all of them:
        try {
            const cleanAddToGroupContext = (clean: PinkyPromise<T>) => {
                clean.groupContext = {
                    id,
                    cleans,
                    isSequential,
                };
            };
            const cleanAddToGroupContextAll = (cleans: PinkyPromise<T>[]) => cleans.map(cleanAddToGroupContext);
            await Promise.all(cleanAddToGroupContextAll(cleans));
            // TODO write tests retries also happen sequentially
            const cleanResults = isSequential ? await promiseAllSequentiallyRecursive(cleans.slice().reverse()) : await Promise.all(cleans);
            // using slice to reverse immutably
            // reverse as an optimization for the sequential case to avoid re-arranging the array every time
            const cleanSuccesses = cleans.map((clean, i) => clean._config.success(cleanResults[i])); // TODO write unit test
            if (cleanSuccesses.some(cleanSuccess => !cleanSuccess)) {
                revertAll();
            } else {
                return cleanResults;
            }
        } catch (cleanError) {
            revertAll();
        }

        // It will work because clean isn't starting to execute as soon as it is created, like a promise, but only when it is awaited
        async function promiseAllSequentiallyRecursive(cleans: PromiseLike<any>[], results: any[] = []): Promise<any[]> {
            if (cleans?.length === 0) {
                return Promise.resolve(results);
            }
            const current = cleans.pop();
            const currentResult = await current; // if it rejects or has an error?
            results.push(currentResult);
            return await promiseAllSequentiallyRecursive(cleans, results);
        }
    }
}
