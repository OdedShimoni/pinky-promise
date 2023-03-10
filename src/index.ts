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
            logger: console, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
            verbose: true, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
        }
    );

    let variableTwo = 0;
    const anotherAsyncAction = new Clean<string>((resolve, reject) => {
        const rejectThis = false;
        if (rejectThis) {
            reject('reject 🙁');
        } else {
            setTimeout(
                function() {
                    ++variableTwo; 
                    resolve('lol 😎')
                    // resolve('toFail')
                }
            , 1000);
        }
    },
    {
        success: function(promiseResolvedValue) {
            return variableTwo === 2; // to cause retry
            // return promiseResolvedValue === 'lol 😎';
        },
        revertOnFailure: false,
        logger: console, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
        verbose: true, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
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
        logger: console, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
        verbose: true, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
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
            // return promiseResolvedValue === 'lol 😎 4th';
            return false; // temp to fail
        },
        revert: () => {
            console.log('reverted 4th');
        },
        logger: console, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
        verbose: true, // TODO get from global config which has to be js file / object (as dotenv did) to allow functions when defining 'logger'
    });

    try {
        // console.log(await addOne);
        console.log(
            await Clean.all([addOne, anotherAsyncAction, thirdAsyncAction, fourthAsyncAction], true)
        );
        // console.log(Clean.allSync([addOne, anotherAsyncAction, thirdAsyncAction, fourthAsyncAction])); // meh
        // debugger;
    } catch (e) {
        console.error(`Clean rejected, Error: '${e}'.`);
    }
})();
// TODO write test that when Clean runs in a group then all cleans receive a groupContext and when run alone it is empty
