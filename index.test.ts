import * as index from '.';

describe('Util tests', () => {
    it('allPropertiesAreEmptyFunctions tests', () => {
        expect(index.allPropertiesAreEmptyFunctions.randomName({})).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName()).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName('randomArgument')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(1)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(true)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(null)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(undefined)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName([])).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName([1, 2, 3])).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName(1, 2, 3)).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName('randomArgument', 1, true, null, undefined, [])).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName({ randomProperty: 'randomValue' })).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.randomName({ randomProperty: 1 })).toBe(undefined);

        const randomString = `_${Math.random()}`;
        expect(index.allPropertiesAreEmptyFunctions[randomString]({})).toBe(undefined);

        expect(index.allPropertiesAreEmptyFunctions.info('Info...')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.log('Log...')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.warn('Warn...')).toBe(undefined);
        expect(index.allPropertiesAreEmptyFunctions.error('Error...')).toBe(undefined);
    })
});