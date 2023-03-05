
export interface IQueue {
    context: {
        [key: string | number | symbol]: any
    };
    config: {
        [key: string | number | symbol]: any
    };
    init: () => Promise<any>;
    close: Function;
    getMessageBatch: (batchSize?: number) => Promise<Array<any>>;
    listen: (callback: (message: any) => Promise<any>) => Promise<any>;
    sendMessage: (id: any, data: any, options?: any) => Promise<any>;
    getNextMessage: () => Promise<any>;
    commitMessage: (message: any) => Promise<any>;
}

export interface IMessage {
    id: any;
    data: any;
    options?: any;
    commit: () => Promise<any>;
}

// Should I have a message interface?
