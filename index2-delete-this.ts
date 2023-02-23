// interface IClean {
//     isRetryable: boolean;
//     isSuccess: () => boolean;

//     // consider changing to a bool if needed, default is: success = promise resolved
//     // ... will be defined after testing some dynamic shit
// }

// interface CleanConfig {
//     isRetryable?: boolean;
//     isSuccess: () => boolean;
//     revert?: Function;
//     isRevertable?: boolean;
//     maxRetryAttempts?: number;
// }

// class Clean<TT> implements PromiseLike<TT> {
//     config: CleanConfig;
//     rescue: Function;
//     innerPromise: PromiseLike<TT>;
//     retryAttemptsCount: number = 0;
//     // I changed type of 'then' method to return 'Promise' instead of 'PromiseLike' so we can use 'catch' method when working with 'then' function instead of 'await'
//     then: <TResult1 = TT, TResult2 = never>(onfulfilled?: ((value: TT) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null) => Promise<TResult1 | TResult2> = function(onfulfilled, onrejected) {
//         return new Promise(async <TResult1 = TT, TResult2 = never>(resolve: (value: TResult1 | TResult2 | PromiseLike<TResult1 | TResult2>) => void, reject: (reason?: any) => void) => {
//             // here the Clean resolves or rejects, regardless of the inner promise
//             try {
//                 const originalPromiseReturn: TT = await this.innerPromise;
//                 if (!this.config.isSuccess(originalPromiseReturn)) {
//                         console.log('rescuing')
//                         if (!this.rescue()) {
//                             await onrejected('reason...'); 
//                             reject('Clean rejected...');
//                             return;
//                         }
//                     }
//                     await onfulfilled(originalPromiseReturn);
//                     resolve(originalPromiseReturn as unknown as TResult1);
//             } catch (innerPromiseError) {
//                 await onrejected(innerPromiseError); 
//                 console.error('inner promise rejected.');
//                 console.error(innerPromiseError);
//             }
//         });
//     };
//     constructor(executor, config: CleanConfig) {
//         if (!config?.revert && config?.isRevertable !== false) {
//             throw new Error('Clean must either have a revert method or explicitly state it is irevertable.');
//         }

//         const innerPromise = new Promise<TT>(executor);
//         this.innerPromise = innerPromise;
//         config && (this.config = config);

//         // default values
//         this.config.isRetryable = this.config?.isRetryable ?? false;
//         this.config.maxRetryAttempts = this.config?.maxRetryAttempts ?? 5;

//         this.rescue = function() {
//             const shouldRetry = this.config.isRetryable && this.config.retryAttemptsCount < this.config.maxRetryAttempts;
//             if (shouldRetry) {
//                 // try again somehow
//                 return; // return something for short circuit
//             }
//             const shouldRevert = this.config.revert;
//             if (shouldRevert) {
//                 return this.config.revert();
//             }
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
//             // ++variable; // temp to fail isSuccess
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

//     // addOne
//     //     .then(
//     //         value => console.log(`what value is this? value: ${value}`),
//     //         error => console.warn(`lol this is inner promise onrejected. error: ${error}`)
//     //     )
//     //     .catch(e => console.error(`Clean rejected, Error: '${e}'. How can I do it with async await?`));

//     try {
//         const value = await addOne;
//         console.log(`what value is this? value: ${value}`);
//     } catch (e) {
//         console.error(`Clean rejected, Error: '${e}'.`);
//     }
// })();
