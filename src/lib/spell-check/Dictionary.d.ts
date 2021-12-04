interface CheckSuggestResult {
	misspelled: boolean;
	suggestions: string[];
}

export default class Dictionary {
	/**
	 * Creates an instance of Dictionary.
	 *
	 * @constructor
	 * @this {Dictionary}
	 * @param {string[]} wordlist A sorted array of strings.
	 */
	constructor(wordlist: string[]);

	/**
	 * Returns the number of words in the dictionary.
	 *
	 * @return {number} The number of words in the dictionary.
	 */
	getLength(): number;

	/**
	 * Set the list of words of the dictionary. a new Circle from a diameter.
	 *
	 * @param {string[]} wordlist A sorted array of strings.
	 */
	setWordlist(wordlist: string[]);

	/**
	 * Verify if a word is in the dictionary.
	 *
	 * @param {string} word A string.
	 * @return {bool} 'true' if the word is in the dictionary, 'false' otherwise.
	 */
	spellCheck(word: string): boolean;

	/**
	 * Verify if a word is misspelled.
	 *
	 * @param {string} word A string.
	 * @return {bool} 'true' if the word is misspelled, 'false' otherwise.
	 */
	isMisspelled(word: string): boolean;

	/**
	 * Get a list of suggestions for a misspelled word.
	 *
	 * @param {string} word A string.
	 * @param {number} limit An integer indicating the maximum number of suggestions (by default 5).
	 * @param {number} maxDistance An integer indicating the maximum edit distance between the word and the suggestions (by default 3).
	 * @return {string[]} An array of strings with the suggestions.
	 */
	getSuggestions(word: string, limit?: number, maxDistance?: number): string[];

	/**
	 * Verify if a word is misspelled and get a list of suggestions.
	 *
	 * @param {string} word A string.
	 * @param {number} limit An integer indicating the maximum number of suggestions (by default 5).
	 * @param {number} maxDistance An integer indicating the maximum edit distance between the word and the suggestions (by default 3).
	 * @return {Object} An object with the properties 'misspelled' (a boolean) and 'suggestions' (an array of strings).
	 */
	checkAndSuggest(word: string, limit?: number, maxDistance?: number): CheckSuggestResult;

	/**
	 * Adds a regular expression that will be used to verify if a word is valid even though is not on the dictionary.
	 * Useful indicate that numbers, URLs and emails should not be marked as misspelled words.
	 *
	 * @param {RegEx} regexp A regular expression.
	 */
	addRegex(regex);

	/**
	 * Clear the list of regultar expressions used to verify if a word is valid even though is not on the dictionary.
	 */
	clearRegexs();
}
