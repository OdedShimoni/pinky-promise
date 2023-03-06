import { Clean } from "./clean";

(async function() {
    const originalValue = 0;
    let variable = 0;

    const addOne = new Clean<string>(
        (resolve, reject) => {
            const toReject = false;

            ++variable;
            // ++variable; // temp to fail success
            // ++variable; // temp to fail success
            // ++variable; // temp to fail success
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
            // success: () => variable === 1,
            success: () => variable === 2, // so bad cuz not idempotent but it's to test the retry
            // success: () => false,
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
        success: function(promiseResolvedValue) {
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
        success: function(promiseResolvedValue) {
            return promiseResolvedValue === 'lol 😎 3rd';
            // return false; // temp to fail
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
        success: function(promiseResolvedValue) {
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
        // console.log(Clean.allSync([addOne, anotherAsyncAction, thirdAsyncAction, fourthAsyncAction])); // meh
        // debugger;
    } catch (e) {
        console.error(`Clean rejected, Error: '${e}'.`);
    }
})();
// TODO write test that when Clean runs in a group then all cleans receive a groupContext and when run alone it is empty
// TODO think of edge cases: e.g. when queue gets filled up with tons of messages. Will a single pinky process them lifo? this means it will take hours and the original promise won't be processed until the end. Maybe an execution needs to be limited to extra 50 messages from the queue, and the number will be configurable
// TODO consider when working in queue mode, handling 'if retry attempts is less than the total retry attempts configed' to the queue's functionality, since I guess there is one in every queue (in Bull there is)