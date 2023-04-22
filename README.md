# Pinky Promise

<div style="text-align: center">

![Maintainer](https://badgen.net/badge/maintainer/Oded%20Shimoni/orange)
&nbsp;
![npm](https://badgen.net/badge/npm/pinky-promise-js/blue)
&nbsp;
![License](https://badgen.net/badge/license/Apache-License-2.0/blue)
&nbsp;
![Size](https://badgen.net/badge/install%20size/4.4kb/blue)
&nbsp;
![Coverage](https://badgen.net/badge/coverage/full/green)
&nbsp;
![PRs](https://badgen.net/badge/PRs/welcome/green)
</div>

A promise you can count on - fail safe and transparent.
-
Pinky Promise is great for dealing with complex flows where you want to ensure that a series of actions are executed successfully.

It has the same interface as 'Promise', along with minimal configuration, and can be used as a drop-in replacement.

```javascript
 // 15 lines of code which will retry each failed update, and if either's retries fail, revert both

const { PinkyPromise } = require('pinky-promise-js');
PinkyPromise.config();

const updateUserInfo = new PinkyPromise( (resolve, reject) => {
  resolve( updateUser({ _id: userId }, { $set: { address: 'New Updated Address' } }) );
}, {
  success: result => result.modifiedCount === 1,
  revert: () => updateUser({ _id: userId }, { $set: { address: 'Old Address' } }),
});

const updateDataWarehouse = new PinkyPromise( (resolve, reject) => {
  resolve( axios.put(`https://datawarehouse.com/api/user/${userId}`, { address: 'New Updated Address' }) );
}, {
  success: result => result.status === 200 && result.data.success === true,
  revert: () => axios.put(`https://datawarehouse.com/api/user/${userId}`, { address: 'Old Address' }),
});

PinkyPromise.all([updateUserInfo, updateDataWarehouse]);
```


## Installation

Install pinky-promise with npm

```bash
  npm install pinky-promise-js
```

## Mini Documentation
## Usage/Examples
This is how you use Pinky Promise. First, you create a new instance of Pinky Promise, and provide it with the following parameters (example above):
1. The promise' execution function which has 'resolve' and 'reject' parameters. The same as the function you provide to the 'Promise' constructor.
2. A config object with the following properties:
    * success: a function which accepts the promise resolved value as a parameter and returns boolean. It should return true if the promise executor succeeded, and false if it failed.
    * revert: a function which will be called if the promise failed, and should revert the promise' execution. If returns explicit 'false', the revert is declared as failed and will also be retried. Can also be canceled.
    * Further configuration options are described below in #Features section.

Example with MongoDB:
```javascript
const { PinkyPromise } = require('pinky-promise-js');
PinkyPromise.config();

const updateUserInfo = new PinkyPromise( (resolve, reject) => {
  resolve(db
    .collection('houses')
    .insertOne({
      address: 'nice',
      size: 'large',
      address: 'nice',
      price: 100000,
    }) );
}, {
  success: result => !!result?.insertedId,
  revert: async function() {
    const res = await db
      .collection('houses')
      .deleteOne({ address: 'nice' }); // see #Best Practices below
    return res.deletedCount === 1;
  },
});

try {
  const updatedUserInfo = await updateUserInfo;
} catch (e) {
  // handle error... see #Transparency below
}
```
PinkyPromise.all is a method which has the exact same interface as *Promise.all*. It accepts an array of pinky promises, and will execute them all. If any of the promises fail to retry, __all of them will be reverted__.

It is good for ensuring synchronicity between multiple promises, and can be used as a drop-in replacement for Promise.all.

Example which synchronizes between MongoDB insert and an API call:
```javascript
const { PinkyPromise } = require('pinky-promise-js');
PinkyPromise.config();

const updateUserInfo = new PinkyPromise( (resolve, reject) => {
  resolve( db
    .collection('houses')
    .insertOne({
      address: 'nice',
      size: 'large',
      address: 'nice',
      price: 100000,
    }) );
}, {
  success: result => !!result?.insertedId,
  revert: async function() {
    const res = await db
      .collection('houses')
      .deleteOne({ address: 'nice' }); // see #Best Practices below
    return res.deletedCount === 1;
  },
});

const updateDataWarehouse = new PinkyPromise( (resolve, reject) => {
  resolve( axios.put(`https://datawarehouse.com/api/user/${userId}`, { address: 'New Updated Address' }) );
}, {
  success: result => result.status === 200 && result.data.success === true,
  revert: () => axios.put(`https://datawarehouse.com/api/user/${userId}`, { address: 'Old Address' }),
});

try {
  const [updatedUserInfo, updatedDataWarehouse] = await PinkyPromise.all([updateUserInfo, updateDataWarehouse]);
} catch (e) {
  // handle error... see #Transparency below
}
```

## Fail Safety
A pinky promise acts like a normal promise, but with a few extra features for fail safety:
1. Checking success: the end of the promise' execution, the `success` method which you provide will be called with the result of the promise. This function will determine whether the promise succeeded or failed.<!-- E.g. If you are updating a record in a database, you can check the result's modified records count, and determine success if it's 1 or above. -->
2. If the `success` method returns true, amazing - we're done and the pinky promise is resolved.
3. Otherwise, the pinky promise will attempt to retry and execute the promise again, until it succeeds or the max number of retry arrempts is reached.
4. After each retry, the pinky promise will call the `success` method with the result again, resolving if it succeeds.
5. If the max number of retry attempts is reached, the pinky promise will call the `revert` method, which you also provide.
6. If the `revert` method fails, the pinky promise will attempt to retry and execute the revert method again, until it succeeds or the revert-retry attempts threshold is reached.

If anything fails during this flow, the pinky promise will be rejected in a transparent way which will describe exactly what went wrong and what is the current state of things (See #Transparency).

One of the most useful features of Pinky Promise is when dealing with multiple pinky promises, `PinkyPromise.all` (which has the exact same interface of the well known `Promise.all`) will check if any of the pinky promises failed, and if so, will call the `revert` method *for all* promises in the group.

## Examples:
Let's take this code:
```javascript
const { PinkyPromise } = require('pinky-promise-js');
PinkyPromise.config();

const updateUserInfo = new PinkyPromise( (resolve, reject) => {
  resolve( db
    .collection('houses')
    .insertOne({
      address: 'nice',
      size: 'large',
      address: 'nice',
      price: 100000,
    }) );
}, {
  success: result => !!result?.insertedId,
  revert: async function() {
    const res = await db
      .collection('houses')
      .deleteOne({ address: 'nice' }); // see #Best Practices below
    return res?.deletedCount === 1;
  },
});

await updateUserInfo; // promise succeeds
```
### If insertion was successful:
1. The promise is executed, and is resolved to:
  ```javascript
  {
    acknowledged: true,
    insertedId: 'some-id',
  }
  ```
2. The 'success' method is called with the result:
  ```javascript
  // result is { acknowledged: true, insertedId: 'some-id' }
  return !!result?.insertedId; // true
  ```
3. The Pinky Promise is resolved, and the result is returned to the user.

### If insertion failed:
1. The promise is executed, and is resolved to:
  ```javascript
  {
    acknowledged: false,
  }
  ```
2. The 'success' method is called with the result:
  ```javascript
  // result is { acknowledged: false }
  return !!result?.insertedId; // false
  ```
3. The Pinky Promise will attempt to retry the promise, and execute it again.
4. The promise is executed again, and this time is resolved to:
  ```javascript
  {
    acknowledged: true,
    insertedId: 'some-id',
  }
  ```
5. The 'success' method is called with the result:
  ```javascript
  // result is { acknowledged: true, insertedId: 'some-id' }
  return !!result?.insertedId; // true
  ```
6. The Pinky Promise is resolved, and the result is returned.

### If insertion failed and retries also fail:
1. The promise is executed, and is resolved to:
  ```javascript
  {
    acknowledged: false,
  }
  ```
2. The 'success' method is called with the result:
  ```javascript
  // result is { acknowledged: false }
  return !!result?.insertedId; // false
  ```
3. The Pinky Promise will attempt to retry the promise, and execute it again.
4. It will fail again and again until reaching max retry attempts threshold, then will attempt to revert the promise.
5. The 'revert' method is called, if pinky promise is executed as part of a group in PinkyPromise.all then revert is called *for each pinky promise in the group*:
  ```javascript
  const res = await db
    .collection('houses')
    .deleteOne({ address: 'nice' }); // see #Best Practices below
  return res?.deletedCount === 1;
  ```
6. If returned value is nothing but explicit `false`, the Pinky Promise will throw a 'PromiseFailedAndReverted' error (See #Transparency).
7. If returned value is indeed explicit false, the Pinky Promise will attempt to retry the revert method again, until reaching max revert-retry attempts threshold. Then if all fail, will throw a 'FatalErrorNotReverted' error (See #Transparency).
### More flows are described below in #Transparency.

## Transparency
There might be numerous kinds of errors along the execution described above.
If any failure occurs, Pinky Promise will throw a precise error describing what went wrong.

In addition, Pinky Promise can be configured with your already in-use logger, and every phase is logged to it:
```javascript
import { PinkyPromise } from 'pinky-promise-js';
import logger from 'my-logger';
PinkyPromise.config({ logger });
// ...
```

* PromiseFailedAndReverted is thrown had the promise' 'success' method returned false, even after all its retry attempts. The promise had gotten to its retry threshold, so revert was initiated and succeeded.
If promise is part of `PinkyPromise.all`, this error means that at least one of the promises in the group failed even after all its retry attempts, and all of them were reverted successfuly.
```javascript
import { PinkyPromise, errors: { PromiseFailedAndReverted } } from 'pinky-promise-js';
// ...
try {
  await PinkyPromise.all([updateUserInfo, updateDataWarehouse]);
} catch (e) {
  if (e instanceof PromiseFailedAndReverted) {
    // handle single promise reverted / group of promises all reverted because at least one failed
  }
}
```

* FatalErrorNotReverted is thrown if the promise failed to be reverted. Is also thrown if as part of a group of promises, at least one of the promises failed, which initiated revert of all of them, but at least one of the promises failed to be reverted.
```javascript
import { PinkyPromise, errors: { FatalErrorNotReverted } } from 'pinky-promise-js';
// ...
try {
  await PinkyPromise.all([updateUserInfo, updateDataWarehouse]);
} catch (e) {
  if (e instanceof FatalErrorNotReverted) {
    // handle single promise could not be retried or reverted / group of promises all reverted because at least one failed even after all retries and revert-retries
  }
}
```

* ProgrammerError is thrown if the user mis-configured the promise, or the global PinkyPromise.
```javascript
import { PinkyPromise, errors: { ProgrammerError } } from 'pinky-promise-js';
// ...
try {
  const pinky = new PinkyPromise( (resolve, reject) => {
    // do something
  },
  {
    success: result => !!result,
    // the user tries to both state 'revert' method and 'revertOnFailure' to false, which isn't logical
    revert: () => // do something to revert,
    revertOnFailure: false,
  });
  const res = await pinky;
} catch (e) {
  if (e instanceof ProgrammerError) {
    // handle programmer error
  }
}
```

* PromiseFailed is thrown if the promise failed, but Pinky Promise is set to not be reverted on failure.
```javascript
import { PinkyPromise, errors: { PromiseFailed } } from 'pinky-promise-js';
// ...
const pinky = new PinkyPromise( (resolve, reject) => {
  // do something
},
{
  success: result => !!result,
  revertOnFailure: false,
});
try {
  const res = await pinky;
} catch (e) {
  if (e instanceof PromiseFailed) {
    // handle single promise failed / group of promises all failed and all are set to not be reverted
  }
}
```

* This is how you can check if the error thrown is part of the promise itself and not a part of the Pinky Promise' fail safety:
```javascript
import { PinkyPromise, errors: { isPinkyPromiseError } } from 'pinky-promise-js';
// ...
const pinky = new PinkyPromise( (resolve, reject) => {
  // do something
},
{
  success: result => !!result,
  revertOnFailure: false,
});
try {
  const res = await pinky;
} catch (e) {
  if (!isPinkyPromiseError(e)) {
    // handle error thrown by the promise itself
  }
}
```

## Best Practices
To allow retry and revert-retry, each method you provide should be idempotent, meaning no matter how many times it is called, it will still cause the same result.
```javascript
// Good
const id = functionWhichGeneratesUniqueId();
const createUser = new PinkyPromise( (resolve, reject) => {
  resolve( axios.put('https://datawarehouse.com/api/upsert-user-by-id', { id, name: 'John Doe' }) ); // no matter how many times it is called, it creates a single user
},
{
  success: result => result.status === 200 && result.data.success === true,
  revert: () => axios.delete('https://datawarehouse.com/api/delete-user', { id }), // no matter how many times it is called, it deletes only the newly created user
});
```
```javascript
// Bad
const createUser = new PinkyPromise( (resolve, reject) => {
  resolve( axios.post('https://datawarehouse.com/api/create-user', { name: 'John Doe' }) ); // calling multiple times creates multiple users
},
{
  success: result => result.status === 200 && result.data.success === true,
  revert: () => axios.post('https://datawarehouse.com/api/delete-user', { name: 'John Doe' }), // calling multiple times might delete multiple users
});
```

Don't use async executors, as *errors in them can't be catched* and are considered an [anti-pattern](https://stackoverflow.com/questions/43036229/is-it-an-anti-pattern-to-use-async-await-inside-of-a-new-promise-constructor/43050114#43050114). Instead, resolve a promise.
```javascript
// Good
const createUser = new PinkyPromise((resolve, reject) => {
  resolve( axios.post('https://datawarehouse.com/api/create-user', { name: 'John Doe' }) ); // Errors aren't supposed to be thrown here
},
{
  success: result => result.status === 200 && result.data.success === true,
  revert: () => axios.post('https://datawarehouse.com/api/delete-user', { name: 'John Doe' }),
});
```
```javascript
// Bad
const createUser = new PinkyPromise( async (resolve, reject) => {
  setTimeout(() => {
      throwsError(); // Errors here can't be caught by JavaScript's try-catch outside this scope
      resolve(res);
    }, 1000);
  });
},
{
  success: result => result.status === 200 && result.data.success === true,
  revert: () => axios.post('https://datawarehouse.com/api/delete-user', { name: 'John Doe' }),
});
```

Keep in mind the possibility of race conditions where Pinky Promise is being retried before the revert, but is finishing after it.


## Features
Pinky Promise has configuration options which allow you to customize it to your needs.
There are 2 types of configuration:
- Promise configuration: the configuration which is passed to the constructor of the promise, implements PinkyPromiseUserConfig interface:
```javascript
const pinky = new PinkyPromise( (resolve, reject) => {
  // do something
},
{
  // This is the promise configuration object
});
```
- Global configuration: the configuration which is passed to the 'PinkyPromise.config' method, implements PinkyPromiseGlobalConfig interface:
```javascript
import { PinkyPromise } from 'pinky-promise-js';
PinkyPromise.config({
  // This is the global configuration object
});
```

### Promise configuration
- `success: () => boolean, required.` A function which determines if the promise executor succeeded. If the function returns true, the promise executor is considered to have succeeded. If the function returns false, the promise executor is considered to have failed and proceeds to its fail safe logic.
- `revert: () => void | false, required.` A function which reverts the promise executor. Is usually called after the retry logic, unless specifically configured to not be called at all. If the promise succeeded, this function is not called. If this functions returns explicit 'false', Pinky Promise will assume the revert failed and will retry to revert until it reaches the revert threshold ('maxRevertAttempts' property at the config, default 5), and then if still not succeeded will throw a 'FatalErrorNotReverted' error.
- `isRetryable: boolean. Default true.` If set to true and 'success' method returns false, the promise executor will be retried.
- `maxRetryAttempts: number. Default is 5.` The maximum number of times the promise executor will be retried if it fails. If the promise executor fails this number of times, Pinky Promise will proceed to revert, unless configured explicitly not to.
- `revertOnFailure: boolean. Default is true.` If true, the revert method will be called if the promise executor failed. Can be set to `false` so the Pinky Promise won't be reverted and only retried.
- `maxRevertAttempts: number. Default is 5.` The maximum number of times the revert method will be called if it fails. If the revert method fails more than this number of times, Pinky Promise will throw a 'FatalErrorNotReverted' error (See '#Transparency' section above).
- `retryMsDelay: number. Default is 1000.` The number of milliseconds Pinky Promise will wait before retrying the promise executor if it failed.
- `revertRetryMsDelay: number. Default is the value of` _retryMsDelay_. The number of milliseconds Pinky Promise will wait before retrying the revert method if it failed.
### Global configuration
- `logger`: an object which implements the *ILogger* interface, default empty. In addition to the example above, can be used with 'console' as following:
```javascript
import { PinkyPromise } from 'pinky-promise-js';
PinkyPromise.config({ logger: console });
// ...
```
- `verbose`: boolean. Default is *true*. *true* is also the recommended value to ensure full transparency under any circumstances. If *true*, logs every phase of the Pinky Promise. If `false`, logs only critical messages (such as failures).
```javascript
import { PinkyPromise } from 'pinky-promise-js';
PinkyPromise.config({ logger: console, verbose: false });
// ...
```
### allSeq
Pinky Promise has a method called `allSeq` which is similar to `PinkyPromise.all` method, but it runs the promises sequentially instead of concurrently.
```javascript
import { PinkyPromise } from 'pinky-promise-js';
// ...
const pinkyPromises = [
  new PinkyPromise( (resolve, reject) => {
    // do something
  },
  {
    success: result => !!result,
    revertOnFailure: false,
  }),
  new PinkyPromise( (resolve, reject) => {
    // do something else
  },
  {
    success: result => !!result,
    revertOnFailure: false,
  }),
];
const results = await PinkyPromise.allSeq(pinkyPromises);
```

## TypeScript
Pinky Promise is written in TypeScript and has full type support.
```typescript
const updateDataWarehouse = new PinkyPromise<AxiosResponse>( (resolve, reject) => {
  resolve( axios.put(`https://datawarehouse.com/api/user/${userId}`, { address: 'New Updated Address' }) );
}, {
  success: result => result.status === 200 && result.data.success === true,
  revert: () => axios.put(`https://datawarehouse.com/api/user/${userId}`, { address: 'Old Address' }),
});
```

## Mechanics
Pinky Promise runs the promise executor only when it is awaited / .then()ed. As opposed to regular promises which executors are run as soon as they are created.
This is to ensure that multiple promises can be created with the same executor to be retried.

## Bugs
Even though Pinky Promise is quite aggressively tested (including integration tests which set up external services and test full flows agains them), it is still a work of progress. If you find a bug, please open an issue / PR.

## Contribution

Contributions are always welcome!

* Edge cases
* Consider more precise errors in group flows (`PinkyPromise.all`), perhaps it's clear enough as is.
* Logs are super comprehensive but are a bit too verbose.
* Any meaningful test, even a small one. You can start with the 'todo' tests in \_\_tests__ folder.
* Also tests are a bit messy, I'm not a fan of the current test setup, especially integration tests, but it works for now.


## People

 - [Oded Shimoni](https://odedshimoni.dev)


## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)

