class MessageValidator {
    /**
     * @param {Object} message - The message to validate.
     * @param {string} message.type - The message type.
     * @param {Object} [message.data] - The message data.
     * @param {Object} options - The options for the validation item.
     * @param {string[]} [options.requiredDataFields] - The required fields for the message type.
     * @param {Object} [options.foundIn] - The configuration for the "foundIn" validation.
     * @param {string[]} options.foundIn.fields - The fields to match in the search array.
     * @param {any[]} options.foundIn.searchArray - The search array to look for matches.
     * @param {Object} [options.notFoundIn] - The configuration for the "notFoundIn" validation.
     * @param {string[]} options.notFoundIn.fields - The fields to match in the search array.
     * @param {any[]} options.notFoundIn.searchArray - The search array to look for matches.
     */
    constructor(message, options = {}) {
        if (!message || typeof message !== "object" || Array.isArray(message)) {
            throw new Error('Invalid input. "message" should be an object.');
        }

        this._message = null;
        this._requiredFields = [];
        this._foundIn = {};
        this._notFoundIn = {};

        this.message = message;
        if (options.hasOwnProperty("requiredDataFields")) {
            this.requiredDataFields = options.requiredDataFields;
        }
        if (options.hasOwnProperty("foundIn")) {
            this.foundIn = options.foundIn;
        }
        if (options.hasOwnProperty("notFoundIn")) {
            this.notFoundIn = options.notFoundIn;
        }
    }

    /**
     * Gets the message.
     * @type {Object}
     */
    get message() {
        return this._message;
    }

    /**
     * Sets the message.
     * @param {Object} message - The message to set.
     * @throws {Error} If the value is not a non-empty object or if message.type is not set to a non-empty string.
     */
    set message(message) {
        if (!message || typeof message !== "object" || Array.isArray(message)) {
            throw new Error('Invalid input. "message" property should be a non-empty object.');
        }

        const { type } = message;

        if (typeof type !== "string" || type.trim().length === 0) {
            throw new Error('Invalid input. "message.type" should be a non-empty string.');
        }

        this._message = message;
    }

    /**
     * Gets the required fields.
     * @type {string[]}
     */
    get requiredDataFields() {
        return this._requiredFields;
    }

    /**
     * Sets the required fields.
     * @param {string[]} value - The required fields to set.
     * @throws {Error} If the value is not an array.
     */
    set requiredDataFields(value) {
        if (!Array.isArray(value)) {
            throw new Error('Invalid input. "requiredDataFields" property should be an array.');
        }

        this._requiredFields = value;
    }

    /**
     * Gets the configuration for the "foundIn" validation.
     * @type {Object}
     */
    get foundIn() {
        return this._foundIn;
    }

    /**
     * Sets the configuration for the "foundIn" validation.
     * @param {Object} value - The configuration for the "foundIn" validation to set.
     * @param {string[]} value.fields - The fields to match in the search array.
     * @param {any[]} [value.searchArray] - The search array to look for matches.
     * @throws {Error} If the value is not a non-empty object or if the searchArray is not an array.
     */
    set foundIn(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error('Invalid input. "foundIn" property should be a non-empty object.');
        }

        const { fields, searchArray } = value;
        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            throw new Error('Invalid input. "foundIn.fields" property should be a non-empty array.');
        }

        if (searchArray && !Array.isArray(searchArray)) {
            throw new Error('Invalid input. "foundIn.searchArray" property should be an array.');
        }

        this._foundIn = { fields, searchArray: searchArray || [] };
    }

    /**
     * Gets the configuration for the "notFoundIn" validation.
     * @type {Object}
     */
    get notFoundIn() {
        return this._notFoundIn;
    }

    /**
     * Sets the configuration for the "notFoundIn" validation.
     * @param {Object} value - The configuration for the "notFoundIn" validation to set.
     * @param {string[]} value.fields - The fields to match in the search array.
     * @param {any[]} [value.searchArray] - The search array to look for matches.
     * @throws {Error} If the value is not a non-empty object or if the searchArray is not an array.
     */
    set notFoundIn(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error('Invalid input. "notFoundIn" property should be a non-empty object.');
        }

        const { fields, searchArray } = value;
        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            throw new Error('Invalid input. "notFoundIn.fields" property should be a non-empty array.');
        }

        if (searchArray && !Array.isArray(searchArray)) {
            throw new Error('Invalid input. "notFoundIn.searchArray" property should be an array.');
        }

        this._notFoundIn = { fields, searchArray: searchArray || [] };
    }

    /**
     * Validates the required fields.
     * @param {Object} data - The data object to validate.
     * @returns {string[]} The missing required fields.
     */
    validateRequiredFields(data) {
        const missingFields = [];
        for (let field of this.requiredDataFields) {
            if (!(field in data)) {
                missingFields.push(field);
            }
        }
        return missingFields;
    }

    /**
     * Validates the "foundIn" condition.
     * @param {Object} data - The data object to validate.
     * @returns {boolean} Whether the "foundIn" condition is valid.
     */
    validateFoundIn(data) {
        if (Object.keys(this.foundIn).length > 0) {
            return this.areFieldsInArray(data, this.foundIn.fields, this.foundIn.searchArray);
        }
        return true;
    }

    /**
     * Validates the "notFoundIn" condition.
     * @param {Object} data - The data object to validate.
     * @returns {boolean} Whether the "notFoundIn" condition is valid.
     */
    validateNotFoundIn(data) {
        if (Object.keys(this.notFoundIn).length > 0) {
            return this.areFieldsNotInArray(data, this.notFoundIn.fields, this.notFoundIn.searchArray);
        }
        return true;
    }

    /**
     * Checks if the specified fields match in any object of the search array.
     * @param {Object} data - The data object to match.
     * @param {string[]} fields - The fields to match.
     * @param {any[]} searchArray - The search array to look for matches.
     * @returns {boolean} Whether the fields match in any object of the search array.
     */
    areFieldsInArray(data, fields, searchArray) {
        return searchArray.some((obj) => {
            console.log(obj);
            console.log(fields);
            console.log(data);
            debugger;

            for (let field of fields) {
                if (obj[field] !== data[field]) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Checks if the specified fields do not match in any object of the search array.
     * @param {Object} data - The data object to match.
     * @param {string[]} fields - The fields to match.
     * @param {any[]} searchArray - The search array to look for matches.
     * @returns {boolean} Whether the fields do not match in any object of the search array.
     */
    areFieldsNotInArray(data, fields, searchArray) {
        return !this.areFieldsInArray(data, fields, searchArray);
    }

    /**
     * Validates the message based on the defined rules.
     * @returns {Promise<Function>} A promise that resolves to true if the message is valid, or rejects with an array of error messages if validation fails.
     */
    validate() {
        return new Promise((resolve, reject) => {
            const errorMessages = [];

            // Check if requiredDataFields is empty, if not, validate it
            const missingFields = this.validateRequiredFields(this.message.data);
            if (this.requiredDataFields.length > 0 && missingFields.length > 0) {
                errorMessages.push(`Missing required fields: ${missingFields.join(", ")}.`);
            }

            // Check if foundIn is empty, if not, validate it
            if (Object.keys(this.foundIn).length > 0 && !this.validateFoundIn(this.message.data)) {
                errorMessages.push(`ID ${this.message.data.id} not found.`);
            }

            // Check if notFoundIn is empty, if not, validate it
            if (Object.keys(this.notFoundIn).length > 0 && !this.validateNotFoundIn(this.message.data)) {
                errorMessages.push(`ID ${this.message.data.id} already exists.`);
            }

            if (errorMessages.length > 0) {
                reject({ errors: errorMessages, message: this.message });
            } else {
                resolve(this.onValidationSuccess);
            }
        });
    }
}

export default MessageValidator;
