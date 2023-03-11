import { v4 as uuidv4 } from 'uuid';
import { PinkyPromiseGlobalConfig, PinkyPromiseGroupContext, PinkyPromiseUserConfig } from "./contract/pinky-promise.contract";
import { ErrorOccuredAndReverted, FatalErrorNotReverted, ProgrammerError, RetriesDidNotSucceed, RevertError } from "./errors";
import { ordinal } from "./ordinal";

export const allPropertiesAreEmptyFunctions: any = new Proxy({}, {
    get: function(_target, _prop) {
        return () => {};
    }
});

const defaultGlobalConfig: PinkyPromiseGlobalConfig = {
    logger: allPropertiesAreEmptyFunctions,
    verbose: true,
}

export class PinkyPromise<TT> implements PromiseLike<TT> {
    private static _globalConfig: PinkyPromiseGlobalConfig;
    public static config(config: Partial<PinkyPromiseGlobalConfig> = defaultGlobalConfig) {
        if (PinkyPromise?._globalConfig) {
            throw new ProgrammerError('PinkyPromise is already configured, you can only configure it once.');
        }
        this._globalConfig = { ...defaultGlobalConfig, ...config };
    }

    private _id: string;

    private _config: PinkyPromiseUserConfig<TT>;
    
    private _innerPromiseExecutor: (resolve: (value?: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void;

    private _innerPromiseLastResolvedValue: TT;

    private _attemptsCount = 0;

    private _revertAttemptsCounts = 0;
    
    public _groupContext?: PinkyPromiseGroupContext;
    // I changed type of 'then' method to return 'Promise' instead of 'PromiseLike' so we can use 'catch' method when working with 'then' function instead of 'await'
    

    private _rescue: Function = async function(isExecutedAsPartOfAGroupFlag = false): Promise<boolean> {
        const { verbose, logger } = PinkyPromise._globalConfig;
        verbose && (logger.log(`PinkyPromise with id: ${this._id} has failed, it resolved with (${JSON.stringify(this._innerPromiseLastResolvedValue)}) and is beginning fail safe logic...`));
        try {
            const retriedSuccessfuly = await this._retry() && await this._config.success(this._innerPromiseLastResolvedValue);
            if (retriedSuccessfuly) {
                verbose && (logger.log(`PinkyPromise with id: ${this._id} was retried successfully, returning true.`));
                return true;
            }

            // it calls revert for every retry attempt so I patched it:
            const finishedRetries = this._attemptsCount >= this._config.maxRetryAttempts;
            if (finishedRetries) {
                throw new RetriesDidNotSucceed(`PinkyPromise with id: ${this._id} couldn't succeed even after its retries.`);
            }

        } catch (e) {
            
            const logString = (e instanceof RetriesDidNotSucceed)
                ? `PinkyPromise with id: ${this._id} failed its retries, reverting...`
                : `PinkyPromise with id: ${this._id} caught an error while retrying, reverting...`;
            verbose && (logger.log(logString));
            return await this._revert(isExecutedAsPartOfAGroupFlag);
            
        }
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

    /**
     * * Contribution
     * * For the future: consider changing PinkyPromise to be made out of 2 structures:
     * * 1. A self retryable promise
     * * 2. PinkyPromise extends SelfRetryablePromise: A revertable promise which extends the self retryable promise
     * * This way we can make the revert method of a self retryable promise and save code
     */
    private _revert = async function(isExecutedAsPartOfAGroupFlag = false) {
        const { verbose, logger } = PinkyPromise._globalConfig;

        if (this._config.revertOnFailure === false) { // consider adding || !this._config.revert or even just !this._config.revert
            verbose && (logger.log(`PinkyPromise with id: ${this._id} is not being reverted because revertOnFailure is set to false, returning true.`));
            return true;
        }

        const isPartOfAGroup = !!this._groupContext;
        if (isPartOfAGroup && !isExecutedAsPartOfAGroupFlag) {
            verbose && (logger.log(`PinkyPromise with id: ${this._id} needs to be reverted and is part of a group, skipping revert inside PinkyPromise and leaving it to happen as part of the group.`));
            return true;
        }

        if (!this._config.revert) {
            /**
             * Super unlikely since we have a validation in constructor
             * But it's here to prevent hacks which cause problems
             */
            verbose && (logger.log(`PinkyPromise with id: ${this._id} is not being reverted because revert function is not defined, returning false.`));
            throw new ProgrammerError(`PinkyPromise with id: ${this._id} failed to revert.`);
        }
        
        verbose && (logger.log(`PinkyPromise with id: ${this._id} is being reverted...`));
        try {
            const revertResult = await this._config.revert();
            if (revertResult !== false) { // to allow the user stating revert failure if explicitly returning false from revert function. if revert failure fails then whole PinkyPromise should reject
                // TODO write unit test for the above comment's functionality
                verbose && (logger.log(`PinkyPromise with id: ${this._id} was reverted successfully, returning true.`));
                return true;
            } else {
                throw new RevertError(`PinkyPromise with id: ${this._id} failed to revert.`);
            }
        } catch (e) {

            // TODO test this
            if (e instanceof RevertError && this._revertAttemptsCounts < this._config.maxRevertAttempts) {
                this._revertAttemptsCounts++;
                verbose && (logger.log(`PinkyPromise with id: ${this._id} caught an error while reverting, retrying to revert...`));
                // TODO test this
                if (isExecutedAsPartOfAGroupFlag) {
                    return await this._revert(isExecutedAsPartOfAGroupFlag);
                }
            }
            
            logger.error(`PinkyPromise with id: ${this._id} failed to revert.`, e);
            throw new FatalErrorNotReverted(`PinkyPromise with id: ${this._id} failed to revert.`);
        }
    }

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
                
                await onfulfilled(this._innerPromiseLastResolvedValue);
                resolve(this._innerPromiseLastResolvedValue as unknown as TResult1);
                return this._innerPromiseLastResolvedValue;
            } catch (innerPromiseError) {
                await onrejected(innerPromiseError); 
                // reject(`PinkyPromise with id: ${this._id} inner promise error. ${innerPromiseError}`); // TODO do we need that?
                verbose && (logger.error(`PinkyPromise with id: ${this._id} inner promise error.`, innerPromiseError));
                return false;
            }
        });
    };
    
    constructor(executor: (resolve: (value: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void, config: PinkyPromiseUserConfig<TT>) {
        if (!PinkyPromise._globalConfig) {
            throw new ProgrammerError(`PinkyPromise is not configured. Please call PinkyPromise.config before creating a PinkyPromise.`);
        }
        if (!config) {
            throw new ProgrammerError(`${this.constructor.name} must have a config object.`);
        }
        if (!config?.revert && config?.revertOnFailure !== false) {
            throw new ProgrammerError(`${this.constructor.name} must either have a revert method or explicitly state don't revert on error with revertOnFailure: false.`);
        }
        if (!config?.success) {
            throw new ProgrammerError(`${this.constructor.name} must have a success method to know if it succeeded.`);
        }

        this._id = uuidv4();

        this._innerPromiseExecutor = executor;

        config && (this._config = config);
        // default values
        this._config.isRetryable = this._config?.isRetryable ?? true;
        this._config.maxRetryAttempts = this._config?.maxRetryAttempts ?? 5;
        this._config.retryMsDelay = this._config?.retryMsDelay ?? 1000;
        this._config.revertRetryMsDelay = this._config?.revertRetryMsDelay ?? 1000;
        this._config.revertOnFailure = this._config?.revertOnFailure ?? true;
        this._config.maxRevertAttempts = this._config?.maxRevertAttempts ?? 5;


        const verbose = PinkyPromise._globalConfig.verbose;
        const logger = PinkyPromise._globalConfig.logger;
        verbose && (logger.log(`PinkyPromise created with id: ${this._id}`,
            this._innerPromiseExecutor.toString(),
            {
                ...this._config,
                revert: this._config?.revert?.toString(),
                success: this._config?.success?.toString() ,
            }));
    }

    static async all<T>(pinkyPromises: (PinkyPromise<T>)[], isSequential = false): Promise<T[] | void> {
        const id = uuidv4();

        const { verbose, logger } = PinkyPromise._globalConfig; // temp, get from global config when available

        verbose && (logger.log(`PinkyPromise.all with id: ${id} is being executed...`));
        // if any of 'pinkyPromises' reject, call '_rescue' on all of them:
        try {

            const pinkyPromiseAddToGroupContext = (pinkyPromise: PinkyPromise<T>) => {
                pinkyPromise._groupContext = {
                    id,
                    pinkyPromises,
                    isSequential,
                };
            };
            const pinkyPromiseAddToGroupContextAll = (pinkyPromises: PinkyPromise<T>[]) => pinkyPromises.map(pinkyPromiseAddToGroupContext);
            await Promise.all(pinkyPromiseAddToGroupContextAll(pinkyPromises));

            // TODO write tests retries also happen sequentially
            const pinkyPromiseResults = isSequential ? await awaitAllSequentially(pinkyPromises.slice().reverse()) : await Promise.all(pinkyPromises);
            // using slice to reverse immutably
            // reverse as an optimization for the sequential case to avoid re-arranging the array every time
            
            const pinkyPromiseSuccesses = pinkyPromises.map((pinkyPromise, i) => pinkyPromise._config.success(pinkyPromiseResults[i])); // TODO write unit test
            if (pinkyPromiseSuccesses.some(pinkyPromiseSuccess => !pinkyPromiseSuccess)) {
                revertAll();
            } else {
                return pinkyPromiseResults;
            }

        } catch (e) {

            if (e instanceof FatalErrorNotReverted) {
                logger.error(`Fatal Error!: PinkyPromise.all with id:${id} error!`, e);
                throw e;
            }

            try {
                await revertAll();
                throw new ErrorOccuredAndReverted(`PinkyPromise.all with id:${id}: Fail safe failed but all pinky promises were reverted successfully.`);
            } catch (e) {
                if (!(e instanceof ErrorOccuredAndReverted)) {
                    throw new FatalErrorNotReverted(`Fatal Error!: PinkyPromise.all with id: ${id} failed to revert all!`);
                }
                throw e;
            }

        }


        function revertAll() {
            try {
                const reversedPinkyPromises = pinkyPromises.reverse();
                const reversedPinkyPromisesReverts = reversedPinkyPromises.map(pinkyPromise => pinkyPromise._revert(true));
                return Promise.all(reversedPinkyPromisesReverts);
                // Revert will always be concurrent even if all is sequential, because I can't see a reason to revert sequentially
            } catch (revertError) {
                logger.error(`Fatal Error!: PinkyPromise.all with id:${id} revert error!`, revertError);

                // test what if one of the first reverts rejects and the error is thrown, if the rest of the reverts are still executed or it stops
                throw new FatalErrorNotReverted(`Fatal Error!: PinkyPromise.all with id:${id} revert error!`);
            }
        }

        // It will work because pinkyPromise isn't starting to execute as soon as it is created, like a promise, but only when it is awaited
        async function awaitAllSequentially(pinkyPromises: PromiseLike<any>[], results: any[] = []): Promise<any[]> {
            if (pinkyPromises?.length === 0) {
                return Promise.resolve(results);
            }
            const current = pinkyPromises.pop();
            const currentResult = await current; // if it rejects or has an error?
            results.push(currentResult);
            return await awaitAllSequentially(pinkyPromises, results);
        }
    }

    static async allSeq<T>(pinkyPromises: (PinkyPromise<T>)[]): Promise<T[] | void> {
        return await PinkyPromise.all(pinkyPromises, true);
    }
}

export { ProgrammerError, ErrorOccuredAndReverted, FatalErrorNotReverted };
