// interface IClean {
//     isRetryable: boolean;
//     isSuccess: () => boolean;

//     // consider changing to a bool if needed, default is: success = promise resolved
//     // ... will be defined after testing some dynamic shit
// }

// class Clean<TT> extends Promise<TT> {
//     isRetryable: boolean;
//     isSuccess: Function;
//     revert: Function;
//     rescue: Function;
//     retryAttemptsCount: 0;
//     maxRetryAttempts: -1;
//     constructor(executor, options) {
//         super(executor);
//         // after 'super' call, internal promise function is already thened
//         options && (this.isSuccess = options.isSuccess);
//         options && (this.revert = options.revert);
//         this.rescue = function() {
//             const shouldRetry = this.isRetryable && this.retryAttemptsCount < this.maxRetryAttempts;
//             if (shouldRetry) {
//                 // try again somehow
//                 return; // return something for short circuit
//             }
//             const shouldRevert = this.revert;
//             if (shouldRevert) {
//                 this.revert();
//             }
//         }
//         this.then = function(onfulfilled, onrejected) {
//             console.log('then wrapper');
//             // im trying to find out where inner promise is being 'thened'
//             return new Promise((resolve, reject) => {
//                 // here the Clean resolves or rejects, regardless of the inner promise
//                 const originalPromiseValue = onfulfilled('wtffff' as any);
//                 if (!this.isSuccess(originalPromiseValue)) {
//                     console.log('rescuing')
//                     if (!this.rescue()) {
//                         return reject(onrejected);
//                     }
//                 }
//                 return resolve(originalPromiseValue);
//             });
//         }
//     }
// }

// (async function() {

//     const originalValue = 0;
//     let variable = 0;

//     const addOne = new Clean(
//         (resolve, reject) => {
//             const toReject = true;

//             ++variable;
//             if (toReject) {
//                 reject('Couldn\'t do action');
//             } else {
//                 resolve('yay');
//             }
//         },
//         {
//             revert: () => {
//                 variable = originalValue;
//             },
//             isSuccess: function() {
//                 return variable === 1;
//             },
//         }
//     );

//     // const anotherAsyncAction = new Clean((resolve, reject) => {
//     //     resolve('lol');
//     // },
//     // {
//     //     isSuccess: function(promiseResolvedValue) {
//     //         return promiseResolvedValue === 'lol';
//     //     }
//     // });



//     try {
//         const res = await addOne;
//         console.log(res);
//         // const res2 = await anotherAsyncAction;
//         // console.log(res2);
//         // anotherAsyncAction.then(console.log);
//     } catch (e) {
//         console.log('Clean rejected');
//     }
// })();
