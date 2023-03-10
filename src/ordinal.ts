const englishOrdinalRules = new Intl.PluralRules("en", {type: "ordinal"});
const englishSuffixes = {
    one: "st",
    two: "nd",
    few: "rd",
    other: "th"
};
export function ordinal(number: number) {
    const category = englishOrdinalRules.select(number);
    const suffix = englishSuffixes[category];
    return (number + suffix);
}
