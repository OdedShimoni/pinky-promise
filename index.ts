interface CleanConstructor {
    new <T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void, options: CleanOptions): CleanType<T>;
}

interface CleanType<T> extends Promise<T> {
    options: CleanOptions;
}

interface CleanOptions {
    isRevertable?: boolean;
}

function Clean<T>(executor, options: CleanOptions): CleanType<T> {
    const promise = new Promise<T>(executor);

    const clean = promise as CleanType<T>;
    console.log('new clean arrived, world is about to change')
    clean.options = options;
    return clean;
}
Clean.prototype = Promise.prototype;

// class Clean extends Promise implements CleanType<any> {
//     isRevertable: boolean;
//     constructor(executor, { isRevertable = false }) {
//         super(executor);
//         this.isRevertable = isRevertable;
//     }
// }

const executor = function (resolve, _reject) {
    resolve('lol');
};
const lol = Clean(executor, { isRevertable: true });
lol.then((value) => {
    console.log(value);
});