
import { PinkyPromise } from '../pinky-promise';
import { ILogger } from './logger.contract';

export interface PinkyPromiseGroupContext {
    id: string;
    pinkyPromises: PinkyPromise<any>[];
    isSequential: boolean;
}
export interface PinkyPromiseUserConfig<T> {
    isRetryable?: boolean;
    success: (innerPromiseReturn?: T) => boolean; // shouldn't be called before _innerPromise is resolved. TODO write a restriction to not allow it and write a test for it. Maybe the test is enough?
    revert?: Function;
    revertOnFailure?: boolean;
    maxRetryAttempts?: number;
}

export interface PinkyPromiseGlobalConfig {
    logger: ILogger;
    verbose: boolean;
}