import { errors, PinkyPromise } from '../src';
import { allPropertiesAreEmptyFunctions } from '../src/pinky-promise';
import { ordinal } from '../src/utility/ordinal';
PinkyPromise.config();

it('allPropertiesAreEmptyFunctions tests', () => {
    expect(allPropertiesAreEmptyFunctions.randomName({})).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName()).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName('randomArgument')).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName(1)).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName(true)).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName(null)).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName(undefined)).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName([])).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName([1, 2, 3])).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName(1, 2, 3)).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName('randomArgument', 1, true, null, undefined, [])).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName({ randomProperty: 'randomValue' })).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.randomName({ randomProperty: 1 })).toBe(undefined);

    const randomString = `_${Math.random()}`;
    expect(allPropertiesAreEmptyFunctions[randomString]({})).toBe(undefined);

    expect(allPropertiesAreEmptyFunctions.info('Info...')).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.log('Log...')).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.warn('Warn...')).toBe(undefined);
    expect(allPropertiesAreEmptyFunctions.error('Error...')).toBe(undefined);
});

describe('isPinkyPromiseError', () => {
    it('should return true for all PinkyPromise errors', () => {
        expect(errors.isPinkyPromiseError(new errors.FatalErrorNotReverted("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.ProgrammerError("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.RevertError("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.PromiseFailed("test error"))).toBe(true);
        expect(errors.isPinkyPromiseError(new errors.PromiseFailedAndReverted("test error"))).toBe(true);
    });

    it('should return false for a non-PinkyPromise error', () => {
        expect(errors.isPinkyPromiseError(new Error('random error'))).toBe(false);
    });

    it('should also return false for an EXTERNAL error with the same name as one of a PinkyPromise error', () => {
        const DifferentErrorWithSameNameAsAPinkyPromiseOne = class extends Error {
            constructor(message: string) {
                super(message);
                this.name = "ProgrammerError";
            }
        };
        expect(errors.isPinkyPromiseError(new DifferentErrorWithSameNameAsAPinkyPromiseOne("test error"))).toBe(false);
    });
});

test('"ordinal" should return the correct ordinal string (sampled test)', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(101)).toBe('101st');
    expect(ordinal(102)).toBe('102nd');
    expect(ordinal(103)).toBe('103rd');
    expect(ordinal(104)).toBe('104th');
    expect(ordinal(111)).toBe('111th');
    expect(ordinal(112)).toBe('112th');
    expect(ordinal(113)).toBe('113th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(101)).toBe('101st');
    expect(ordinal(102)).toBe('102nd');
    expect(ordinal(103)).toBe('103rd');
    expect(ordinal(121)).toBe('121st');
    expect(ordinal(122)).toBe('122nd');
    expect(ordinal(123)).toBe('123rd');
    expect(ordinal(1001)).toBe('1001st');
    expect(ordinal(1002)).toBe('1002nd');
    expect(ordinal(1003)).toBe('1003rd');
    expect(ordinal(1004)).toBe('1004th');
    expect(ordinal(1011)).toBe('1011th');
    expect(ordinal(1012)).toBe('1012th');
    expect(ordinal(1013)).toBe('1013th');
    expect(ordinal(1111)).toBe('1111th');
    expect(ordinal(1112)).toBe('1112th');
    expect(ordinal(1113)).toBe('1113th');
    expect(ordinal(1021)).toBe('1021st');
    expect(ordinal(1022)).toBe('1022nd');
    expect(ordinal(1023)).toBe('1023rd');
    expect(ordinal(1101)).toBe('1101st');
    expect(ordinal(1102)).toBe('1102nd');
    expect(ordinal(1103)).toBe('1103rd');
    expect(ordinal(1121)).toBe('1121st');
    expect(ordinal(1122)).toBe('1122nd');
});
