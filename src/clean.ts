import { v4 as uuidv4 } from 'uuid';
import { CleanGroupContext, CleanUserConfig } from "./contract/clean.contract";
import { Bull } from "./implementations/queue/bull.implementation";
import { ordinal } from "./ordinal";

const queueMode = true; // TODO get from global config file and add generically to the Clean class
const queueConfig = {
    host: "localhost",
    port: 6379,
    password: "",
}; // TODO get from global config file and add generically to the Clean class

const queue = new Bull(queueConfig); // temp + use with dependency injection

// TODO test this + write unit test
const allPropertiesAreEmptyFunctions: any = new Proxy({}, {
    get: function(_target, _prop) {
        return () => {};
    }
});

export class Clean<TT> implements PromiseLike<TT> {
    private _id: string;
    private _config: CleanUserConfig<TT>;
    private _innerPromiseExecutor: (resolve: (value?: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void;
    private _innerPromiseLastResolvedValue: TT;
    private _attemptsCount: number = 0;
    private _rescue: Function = async function(isExecutedAsPartOfAGroupFlag = false) {
        this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is being rescued...`));
        const retriedSuccessfuly = await this._retry() && await this._config.success(this._innerPromiseLastResolvedValue);
        if (retriedSuccessfuly) {
            this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} was retried successfully, returning true.`));
            return true;
        }
        if (queueMode) {
            this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} couldn't success even after its retries, leaving in queue for future execution.`));
            return;
        }
        // for some reason it calls revert for every retry attempt
        this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} couldn't success even after its retries and we don't work with a queue, reverting...`));
        return this._revert(isExecutedAsPartOfAGroupFlag);
    };
    private _retry = async function() {
        const shouldRetry = this._config.isRetryable && this._attemptsCount < this._config.maxRetryAttempts;
        if (!this._config.isRetryable) {
            this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is set as not retryable, skipping retry.`));
            return;
        }
        if (this._attemptsCount >= this._config.maxRetryAttempts) {
            this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} has reached max retry attempts, failed retry/s.`));
            return;
        }
        if (shouldRetry) {
            this._attemptsCount++;
            this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is being retried for the ${ordinal(this._attemptsCount)} time...`));
            return await this; // TODO write unit test
        }
    }
    private _revert = async function(isExecutedAsPartOfAGroupFlag = false) {
        if (this._config.revertOnFailure === false) { // consider adding || !this._config.revert or even just !this._config.revert
            this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is not being reverted because revertOnFailure is set to false, returning true.`));
            return true;
        }

        const isPartOfAGroup = !!this.groupContext;
        if (isPartOfAGroup && !isExecutedAsPartOfAGroupFlag) {
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
    }
    private _failSafeExecute = async function(externalExecutor = '') {
        // consider thread safety + scope safety for code which an external user writes
        try {
            const executor = externalExecutor ? new Function(externalExecutor) : this._innerPromiseExecutor;
            const innerPromise = new Promise<TT>(executor);
            this._innerPromiseLastResolvedValue = await innerPromise;
            if (!this._config.success(this._innerPromiseLastResolvedValue)) {
                if (!await this._rescue()) {
                    this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} rescue failed, returning false.`));
                    // await onrejected(`Clean with id: ${this._id} rescue failed.`); 
                    // reject(`Clean with id: ${this._id} rescue failed.`);
                    return false;
                }
            }
            return this._innerPromiseLastResolvedValue;
            // TODO try make these 3 as atomic as possible
            // await onfulfilled(this._innerPromiseLastResolvedValue); // TODO add to the 'then' method
            // message && (await queue.commitMessage(message)); // TODO add to the 'then' method
            // resolve(this._innerPromiseLastResolvedValue as unknown as TResult1); // TODO add to the 'then' method
        } catch (innerPromiseError) {
            // await onrejected(innerPromiseError);  // TODO add to the 'then' method
            // reject(`Clean with id: ${this._id} inner promise error. ${innerPromiseError}`); // TODO do I need that?
            this._config.verbose && (this._config.logger.error(`Clean with id: ${this._id} inner promise error. ${innerPromiseError}`));
            return false;
        }
    }
    groupContext?: CleanGroupContext;
    // I changed type of 'then' method to return 'Promise' instead of 'PromiseLike' so we can use 'catch' method when working with 'then' function instead of 'await'
    then: <TResult1 = TT, TResult2 = never>(onfulfilled?: ((value: TT) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null) => Promise<TResult1 | TResult2> = function(onfulfilled, onrejected) {
        return new Promise(async <TResult1 = TT, TResult2 = never>(resolve: (value: TResult1 | TResult2 | PromiseLike<TResult1 | TResult2>) => void, reject: (reason?: any) => void) => {
            // here the Clean resolves or rejects, regardless of the inner promise
            let message;
            // insert to queue:
            if (queueMode) {
                await queue.init(); // TODO get out of here
                this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} is being inserted to queue...`));
                // TODO test
                message = await queue.sendMessage(this._id, { // TODO generic queue
                    executor: this._innerPromiseExecutor.toString(),
                    // moduleExports: module.exports, // commenting to see if it prevents weird bull error
                    // moduleChildren: module.children, // circular dependency
                });
                const messageBatch = await queue.getMessageBatch(5); // TODO not 5 but get from config
                // TODO what do I do if the Clean itself isn't in the threshold? should I limit threshold and simply return all queue?
                // TODO add mechanism for synchronous execution of messages
                // if yes, what if I take all messages and in the middle the app crashes? it should be fine because messages should be commited only after execution (at least once)
                // this kind of limits the queue usage to only 1 machine, do I not kind of mess with the purpose of a queue? But the queue here is mainly to prevent Cleans from not executing due to an app crash
                const messageBatchExecutors = messageBatch
                    .filter(executor => !!executor)
                    .map(message => message?.data?.executor); // TODO generic queue
                const messageBatchExecutionPromises = messageBatchExecutors.map(this._failSafeExecute);
                const messageReturnValues = await Promise.all(messageBatchExecutionPromises);
                console.log(messageReturnValues); // what now?
            } else {
                const isSuccess = await this._failSafeExecute();
                if (!isSuccess) {
                    this._config.verbose && (this._config.logger.log(`Clean with id: ${this._id} failed, returning false.`));
                    await onrejected(`Clean with id: ${this._id} failed.`); 
                    // reject(`Clean with id: ${this._id} failed.`); // TODO do I need this?
                    return false;
                }
            }
        });
    };
    constructor(executor: (resolve: (value: TT | PromiseLike<TT>) => void, reject: (reason?: any) => void) => void, config: CleanUserConfig<TT>) {
        if (!config?.revert && config?.revertOnFailure !== false) {
            throw new Error(`${this.constructor.name} must either have a revert method or explicitly state don't revert on error with revertOnFailure: false.`);
        }

        this._id = uuidv4();

        // const _innerPromise = new Promise<TT>(executor);
        this._innerPromiseExecutor = executor;
        // this._innerPromise = _innerPromise;

        config && (this._config = config);
        // default values
        this._config.isRetryable = this._config?.isRetryable ?? true;
        this._config.verbose = this._config?.verbose ?? false;
        this._config.maxRetryAttempts = this._config?.maxRetryAttempts ?? 5;
        this._config.logger = config?.logger ?? allPropertiesAreEmptyFunctions;

        this._config.verbose && (this._config.logger.log(`Clean created with id: ${this._id}`, this)); // temp commentation because it is too verbose // ? if I can log the code itself of the executor, it would be easier to understand which Clean this is

    }

    static async all<T>(cleans: (Clean<T>)[]): Promise<T[] | void> {
        const id = uuidv4();

        const verbose = true; // temp, get from global config when available
        const logger = console; // temp, get from global config when available

        verbose && (logger.log(`Clean.all with id: ${id} is being executed...`));
        function revertAll() {
            try {
                const reversedCleans = cleans.reverse();
                
                // ? should it be sync (for in)? or async(forEach)? maybe something else? perhaps user will be able to config either sync or async execution
                reversedCleans.forEach(clean => clean._config.revertOnFailure !== false ? clean._revert(true) : true);
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
            const cleanSuccesses = cleans.map((clean, i) => clean._config.success(cleanResults[i])); // TODO write unit test
            if (cleanSuccesses.some(cleanSuccess => !cleanSuccess)) {
                if (!queueMode) {
                    revertAll();
                }
            } else {
                return cleanResults;
            }
        } catch (cleanError) {
            if (!queueMode) {
                revertAll();
            }
        }
    }
}
// TODO close the queue connection
// TODO if a clean is executed from the queue, it can't be debugged because the code executed comes from the queue and not the machine's memory. So current job should be processed from memory and not from queue.
