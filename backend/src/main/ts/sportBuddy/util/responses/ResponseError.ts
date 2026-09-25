export const ErrorMsgs = {
    INVALID_CREDENTIALS: { code: 9900, message: "The username-password pair is not valid" },
    USER_ALREADY_EXISTS: { code: 9901, message: "Error in creating an account because the username already exists" },
    USER_NOT_FOUND: { code: 9902, message: "The username referred in the operation doesn't exist in registered accounts" },
    INVALID_TOKEN: { code: 9903, message: "The operation is called with an invalid token (wrong format for example)" },
    TOKEN_EXPIRED: { code: 9904, message: "The operation is called with a token that is expired" },
    UNAUTHORIZED: { code: 9905, message: "The operation is not allowed for the user role" },
    INVALID_INPUT: { code: 9906, message: "The call is using input data not following the correct specification" },
    FORBIDDEN: { code: 9907, message: "The operation generated a forbidden error by other reason" }
} as const;

export type ErrorMsg = typeof ErrorMsgs[keyof typeof ErrorMsgs];

export class ResponseError {
    public status: string;
    public data: string;

    constructor(error: string, code: number, errorMessage: ErrorMsg) {
        this.status = error;
        this.data = errorMessage.message;
    }
}