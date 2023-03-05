
import { Clean } from '../clean';
import { ILogger } from './logger.contract';

export interface CleanGroupContext {
    id: string;
    cleans: Clean<any>[];
}
export interface CleanUserConfig<T> {
    isRetryable?: boolean;
    success: (innerPromiseReturn?: T) => boolean; // shouldn't be called before _innerPromise is resolved. TODO write a restriction to not allow it and write a test for it
    revert?: Function;
    revertOnFailure?: boolean;
    maxRetryAttempts?: number;
    logger?: ILogger; // TODO get logger from global config file, since it is single for all Clean instances
    verbose?: boolean; // TODO get logger from global config file, since it is single for all Clean instances
}
