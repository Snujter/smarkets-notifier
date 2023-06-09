class MessageValidator {
    constructor(validations) {
        this.validations = [];

        if (!Array.isArray(validations)) {
            throw new Error("Invalid input. Expected validations to be an array.");
        }

        for (let obj of validations) {
            if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
                throw new Error("Invalid input. Each validation item should be an object.");
            }

            const { type, requiredFields = [], foundIn = [], notFoundIn = [] } = obj;

            if (!type) {
                throw new Error('Invalid input. "type" property is required.');
            }

            if (!requiredFields || !Array.isArray(requiredFields)) {
                throw new Error('Invalid input. "requiredFields" property should be an array.');
            }

            if (!foundIn || !Array.isArray(foundIn)) {
                throw new Error('Invalid input. "foundIn" property should be an array.');
            }

            if (!notFoundIn || !Array.isArray(notFoundIn)) {
                throw new Error('Invalid input. "notFoundIn" property should be an array.');
            }

            this.validations.push({ type, requiredFields, foundIn, notFoundIn });
        }

        this.isValid = true;
        this.errorMessages = [];
    }

    getMissingFields(obj, requiredFields) {
        const missingFields = [];
        for (let field of requiredFields) {
            if (!(field in obj)) {
                missingFields.push(field);
            }
        }
        return missingFields;
    }

    isIdInArray(id, array) {
        return array.some((obj) => obj.id === id);
    }

    validateMessage(type, data) {
        this.isValid = true;
        this.errorMessages = [];

        const item = this.validations.find((item) => item.type === type);
        if (!item) {
            this.errorMessages.push(`Unknown type: ${type}.`);
            return this.isValid;
        }

        const missingFields = this.getMissingFields(data, item.requiredFields);
        if (missingFields.length > 0) {
            this.errorMessages.push(`Missing required fields for ${type}: ${missingFields.join(", ")}.`);
        }

        if (item.foundIn.length > 0 && !this.isIdInArray(data.id, item.foundIn)) {
            this.errorMessages.push(`ID ${data.id} not found.`);
        }

        if (item.notFoundIn.length > 0 && this.isIdInArray(data.id, item.notFoundIn)) {
            this.errorMessages.push(`ID ${data.id} already exists.`);
        }

        if (this.errorMessages.length > 0) {
            this.isValid = false;
        }

        return this.isValid;
    }
}

export default MessageValidator;
