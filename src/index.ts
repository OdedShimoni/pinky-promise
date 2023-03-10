import { PinkyPromise } from "./pinky-promise";
PinkyPromise.config({
    logger: console,
    verbose: true,
});

(async function() {
    const originalValue = 0;
    let variable = 0;

    const addOne = new PinkyPromise<any>(
        (resolve, reject) => {
            const toReject = false;

            ++variable;
            // ++variable; // temp to fail success
            // ++variable; // temp to fail success
            // ++variable; // temp to fail success
            if (toReject) {
                reject('Couldn\'t do action');
            } else {
                resolve({ yay: 'yay' });
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
        }
    );

    let variableTwo = 0;
    const anotherAsyncAction = new PinkyPromise<string>((resolve, reject) => {
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
    });

    const thirdAsyncAction = new PinkyPromise<string>((resolve, reject) => {
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
    });

    const fourthAsyncAction = new PinkyPromise<string>((resolve, reject) => {
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
    });

    try {
        console.log(await addOne);
        // console.log(await fourthAsyncAction);
        // console.log(
        //     await PinkyPromise.all([addOne, anotherAsyncAction, thirdAsyncAction, fourthAsyncAction], false)
        // );
        // console.log(PinkyPromise.allSync([addOne, anotherAsyncAction, thirdAsyncAction, fourthAsyncAction])); // meh
        // debugger;
    } catch (e) {
        console.error(`PinkyPromise rejected, Error: '${e}'.`);
    }
})();
