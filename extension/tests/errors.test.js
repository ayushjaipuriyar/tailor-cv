// Unit tests for error handling utilities
// Tests ExtensionError class and error mapping

describe('Error Handling', () => {
    let ExtensionError, ErrorCodes, handleError;

    beforeEach(() => {
        ExtensionError = class ExtensionError extends Error {
            constructor(message, code, recoverable = true) {
                super(message);
                this.name = 'ExtensionError';
                this.code = code;
                this.recoverable = recoverable;
            }
        };

        ErrorCodes = {
            NO_API_KEY: 'NO_API_KEY',
            NO_BASE_RESUME: 'NO_BASE_RESUME',
            NETWORK_ERROR: 'NETWORK_ERROR',
            API_ERROR: 'API_ERROR',
            RATE_LIMIT: 'RATE_LIMIT',
            INVALID_RESPONSE: 'INVALID_RESPONSE',
            STORAGE_ERROR: 'STORAGE_ERROR',
            COMPILATION_ERROR: 'COMPILATION_ERROR',
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            OFFLINE_ERROR: 'OFFLINE_ERROR'
        };

        handleError = (error) => {
            const errorCode = error.code;
            const userMessages = {
                [ErrorCodes.NO_API_KEY]: {
                    title: 'API Key Required',
                    message: 'Please configure your Gemini API key in settings.',
                    action: 'Open Settings'
                },
                [ErrorCodes.NO_BASE_RESUME]: {
                    title: 'Base Resume Required',
                    message: 'Please upload your base LaTeX resume in settings.',
                    action: 'Open Settings'
                },
                [ErrorCodes.NETWORK_ERROR]: {
                    title: 'Connection Error',
                    message: 'Unable to reach the server. Please check your internet connection.',
                    action: 'Retry'
                },
                [ErrorCodes.RATE_LIMIT]: {
                    title: 'Rate Limit Exceeded',
                    message: 'Too many requests. Please wait a moment and try again.',
                    action: 'OK'
                },
                [ErrorCodes.API_ERROR]: {
                    title: 'API Error',
                    message: error.message || 'An error occurred while processing your request.',
                    action: 'OK'
                },
                [ErrorCodes.COMPILATION_ERROR]: {
                    title: 'Compilation Error',
                    message: 'Failed to compile LaTeX to PDF. Please check your LaTeX syntax.',
                    action: 'OK'
                },
                [ErrorCodes.VALIDATION_ERROR]: {
                    title: 'Validation Error',
                    message: error.message || 'Please check your input and try again.',
                    action: 'OK'
                }
            };

            return userMessages[errorCode] || {
                title: 'Error',
                message: error.message || 'An unexpected error occurred.',
                action: 'OK'
            };
        };
    });

    describe('ExtensionError', () => {
        test('should create error with message and code', () => {
            const error = new ExtensionError('Test error', ErrorCodes.API_ERROR);
            expect(error.message).toBe('Test error');
            expect(error.code).toBe(ErrorCodes.API_ERROR);
            expect(error.recoverable).toBe(true);
        });

        test('should create error with recoverable flag', () => {
            const error = new ExtensionError('Test error', ErrorCodes.API_ERROR, false);
            expect(error.recoverable).toBe(false);
        });

        test('should be instance of Error', () => {
            const error = new ExtensionError('Test error', ErrorCodes.API_ERROR);
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe('handleError', () => {
        test('should map NO_API_KEY error correctly', () => {
            const error = new ExtensionError('API key missing', ErrorCodes.NO_API_KEY);
            const result = handleError(error);

            expect(result.title).toBe('API Key Required');
            expect(result.message).toBe('Please configure your Gemini API key in settings.');
            expect(result.action).toBe('Open Settings');
        });

        test('should map NO_BASE_RESUME error correctly', () => {
            const error = new ExtensionError('Base resume missing', ErrorCodes.NO_BASE_RESUME);
            const result = handleError(error);

            expect(result.title).toBe('Base Resume Required');
            expect(result.message).toBe('Please upload your base LaTeX resume in settings.');
            expect(result.action).toBe('Open Settings');
        });

        test('should map NETWORK_ERROR correctly', () => {
            const error = new ExtensionError('Network failed', ErrorCodes.NETWORK_ERROR);
            const result = handleError(error);

            expect(result.title).toBe('Connection Error');
            expect(result.message).toBe('Unable to reach the server. Please check your internet connection.');
            expect(result.action).toBe('Retry');
        });

        test('should map RATE_LIMIT error correctly', () => {
            const error = new ExtensionError('Too many requests', ErrorCodes.RATE_LIMIT);
            const result = handleError(error);

            expect(result.title).toBe('Rate Limit Exceeded');
            expect(result.message).toBe('Too many requests. Please wait a moment and try again.');
            expect(result.action).toBe('OK');
        });

        test('should map API_ERROR with custom message', () => {
            const error = new ExtensionError('Custom API error', ErrorCodes.API_ERROR);
            const result = handleError(error);

            expect(result.title).toBe('API Error');
            expect(result.message).toBe('Custom API error');
            expect(result.action).toBe('OK');
        });

        test('should map COMPILATION_ERROR correctly', () => {
            const error = new ExtensionError('LaTeX compilation failed', ErrorCodes.COMPILATION_ERROR);
            const result = handleError(error);

            expect(result.title).toBe('Compilation Error');
            expect(result.message).toBe('Failed to compile LaTeX to PDF. Please check your LaTeX syntax.');
            expect(result.action).toBe('OK');
        });

        test('should map VALIDATION_ERROR with custom message', () => {
            const error = new ExtensionError('Invalid input', ErrorCodes.VALIDATION_ERROR);
            const result = handleError(error);

            expect(result.title).toBe('Validation Error');
            expect(result.message).toBe('Invalid input');
            expect(result.action).toBe('OK');
        });

        test('should handle unknown error codes', () => {
            const error = new ExtensionError('Unknown error', 'UNKNOWN_CODE');
            const result = handleError(error);

            expect(result.title).toBe('Error');
            expect(result.message).toBe('Unknown error');
            expect(result.action).toBe('OK');
        });

        test('should handle errors without message', () => {
            const error = new ExtensionError('', ErrorCodes.API_ERROR);
            const result = handleError(error);

            expect(result.message).toBe('An error occurred while processing your request.');
        });
    });

    describe('Error Codes', () => {
        test('should have all required error codes', () => {
            expect(ErrorCodes.NO_API_KEY).toBe('NO_API_KEY');
            expect(ErrorCodes.NO_BASE_RESUME).toBe('NO_BASE_RESUME');
            expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
            expect(ErrorCodes.API_ERROR).toBe('API_ERROR');
            expect(ErrorCodes.RATE_LIMIT).toBe('RATE_LIMIT');
            expect(ErrorCodes.INVALID_RESPONSE).toBe('INVALID_RESPONSE');
            expect(ErrorCodes.STORAGE_ERROR).toBe('STORAGE_ERROR');
            expect(ErrorCodes.COMPILATION_ERROR).toBe('COMPILATION_ERROR');
            expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
            expect(ErrorCodes.OFFLINE_ERROR).toBe('OFFLINE_ERROR');
        });
    });
});
