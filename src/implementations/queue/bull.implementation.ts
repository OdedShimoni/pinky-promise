import { Job, Queue, Worker } from "bullmq";
import { IQueue } from "../../contract/queue.contract";

// TODO consider making properties private etc.
// TODO consider edge cases
// TODO test
export class Bull implements IQueue {
    config: { [key: string]: any;[key: number]: any;[key: symbol]: any; };
    context: {
        queue?: Queue;
        [key: string]: any;[key: number]: any;[key: symbol]: any;
    };
    constructor(
        config: { [key: string]: any;[key: number]: any;[key: symbol]: any; },
        extraBullConfig?: {
            [key: string]: any;
            [key: number]: any;
            [key: symbol]: any;
        }
    ) {
        this.config = config;
        this.context = this?.context ?? {};
        this.context.extraBullConfig = extraBullConfig ?? {};
    }
    
    init = async () => {
        // TODO if already inited then bye
        const moduleConfig = require("../../../module-config.json");
        const moduleName = moduleConfig?.nameKebabCase || "pinky-promise";
        const queueName = `${moduleName}-queue-bull`;
        this.context.queueName = queueName;
        const queue = new Queue(queueName, {
            ...this.context?.extraBullConfigs ?? {},
            connection: {
                host: this.config?.queue?.host || "localhost",
                port: this.config?.queue?.port || 6379,
                password: this.config?.queue?.password || "",
            },
        });
        this.context.queue = queue;
    };
    
    close: Function = () => {
        return this.context.worker?.close();
    };
    sendMessage = async (id: any, data: any, options?: any) => {
        const queue = this.context.queue;
        const job = await queue.add(id, data, options);
        return job;
    };
    // wasn't tested
    getNextMessage = async () => {
        const uniqueToken = require("crypto").randomBytes(16).toString("hex");
        const singleUseWorker = new Worker(this.context.queueName);

        const job = (await singleUseWorker.getNextJob(uniqueToken)) as Job;
        await singleUseWorker.close(); // should we remove the await here?
        return job;
    };
    
    commitMessage: (message: Job) => Promise<Boolean> = async message => {
        // TODO try catch ?
        const uniqueToken = require("crypto").randomBytes(16).toString("hex");
        // const uniqueToken = false; // temp
        const [_jobData, jobId] = await message.moveToCompleted(message?.id, uniqueToken); // TODO What do I need to write here?
        return !!jobId;
    };

    // wasn't tested
    // TODO fix signature type from any
    getMessageBatch: (batchSize?: number) => Promise<any> = async batchSize => {
        const uniqueToken = require("crypto").randomBytes(16).toString("hex");
        const singleUseWorker = new Worker(this.context.queueName);
        const jobsPromise = new Array(batchSize).fill(0).map(() => {
            const job = (singleUseWorker.getNextJob(uniqueToken)) as Promise<Job>;
            return job;
        });
        await singleUseWorker.close(); // should we remove the await here?
        return Promise.all(jobsPromise);
    };

    // Instead of listen, let's return an array of promises which the Clean can await
    listen: (callback: (message: Job) => Promise<any>) => Promise<any> = async callback => {
        const worker = new Worker(
            this.context.queueName,
            callback,
            {
                autorun: false,
                // maxStalledCount: 0,
                // lockDuration: 1000 * 60 * 60 * 24, // 24 hours
            }
        );
        this.context.worker = worker;
        worker.run();
    }
}
