// Unit tests for validation utilities
// Tests input validation for job descriptions, API keys, and LaTeX content

describe('Validation Utilities', () => {
    describe('validateJobDescription', () => {
        const validateJobDescription = (jd) => {
            if (!jd || typeof jd !== 'string') {
                return { valid: false, error: 'Job description is required.' };
            }
            const trimmedJd = jd.trim();
            if (trimmedJd.length === 0) {
                return { valid: false, error: 'Job description cannot be empty.' };
            }
            if (trimmedJd.length < 16) {
                return { valid: false, error: 'Job description must be at least 16 characters long.' };
            }
            return { valid: true, error: null };
        };

        test('should validate valid job description', () => {
            const result = validateJobDescription('Software Engineer position at tech company');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should reject empty job description', () => {
            const result = validateJobDescription('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Job description cannot be empty.');
        });

        test('should reject job description shorter than 16 characters', () => {
            const result = validateJobDescription('Short JD');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Job description must be at least 16 characters long.');
        });

        test('should reject null job description', () => {
            const result = validateJobDescription(null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Job description is required.');
        });

        test('should reject non-string job description', () => {
            const result = validateJobDescription(123);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Job description is required.');
        });
    });

    describe('validateApiKey', () => {
        const validateApiKey = (apiKey) => {
            if (!apiKey || typeof apiKey !== 'string') {
                return { valid: false, error: 'API key is required. Please configure it in settings.' };
            }
            const trimmedKey = apiKey.trim();
            if (trimmedKey.length === 0) {
                return { valid: false, error: 'API key cannot be empty. Please configure it in settings.' };
            }
            if (trimmedKey.length < 10) {
                return { valid: false, error: 'API key appears to be invalid. Please check your settings.' };
            }
            return { valid: true, error: null };
        };

        test('should validate valid API key', () => {
            const result = validateApiKey('valid-api-key-1234567890');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should reject empty API key', () => {
            const result = validateApiKey('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('API key cannot be empty. Please configure it in settings.');
        });

        test('should reject short API key', () => {
            const result = validateApiKey('short');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('API key appears to be invalid. Please check your settings.');
        });

        test('should reject null API key', () => {
            const result = validateApiKey(null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('API key is required. Please configure it in settings.');
        });
    });

    describe('validateBaseResume', () => {
        const validateBaseResume = (baseTex) => {
            if (!baseTex || typeof baseTex !== 'string') {
                return { valid: false, error: 'Base resume is required. Please configure it in settings.' };
            }
            const trimmedTex = baseTex.trim();
            if (trimmedTex.length === 0) {
                return { valid: false, error: 'Base resume cannot be empty. Please configure it in settings.' };
            }
            if (!trimmedTex.includes('\\documentclass') && !trimmedTex.includes('\\begin{document}')) {
                return { valid: false, error: 'Base resume does not appear to be valid LaTeX. Please check your settings.' };
            }
            return { valid: true, error: null };
        };

        test('should validate valid LaTeX resume with documentclass', () => {
            const result = validateBaseResume('\\documentclass{article}\\begin{document}Test\\end{document}');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should validate valid LaTeX resume with begin document', () => {
            const result = validateBaseResume('\\begin{document}Test\\end{document}');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should reject empty base resume', () => {
            const result = validateBaseResume('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Base resume cannot be empty. Please configure it in settings.');
        });

        test('should reject non-LaTeX content', () => {
            const result = validateBaseResume('This is not LaTeX');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Base resume does not appear to be valid LaTeX. Please check your settings.');
        });

        test('should reject null base resume', () => {
            const result = validateBaseResume(null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Base resume is required. Please configure it in settings.');
        });
    });

    describe('validateBackendUrl', () => {
        const validateBackendUrl = (url) => {
            if (!url || typeof url !== 'string') {
                return { valid: false, error: 'Backend URL is required.' };
            }
            const trimmedUrl = url.trim();
            if (trimmedUrl.length === 0) {
                return { valid: false, error: 'Backend URL cannot be empty.' };
            }
            try {
                const urlObj = new URL(trimmedUrl);
                if (urlObj.protocol !== 'https:' &&
                    urlObj.hostname !== 'localhost' &&
                    urlObj.hostname !== '127.0.0.1') {
                    return { valid: false, error: 'Backend URL must use HTTPS protocol for security.' };
                }
                return { valid: true, error: null };
            } catch (error) {
                return { valid: false, error: 'Backend URL is not a valid URL.' };
            }
        };

        test('should validate HTTPS URL', () => {
            const result = validateBackendUrl('https://example.com');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should validate localhost HTTP URL', () => {
            const result = validateBackendUrl('http://localhost:3000');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should validate 127.0.0.1 HTTP URL', () => {
            const result = validateBackendUrl('http://127.0.0.1:3000');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should reject HTTP URL for non-localhost', () => {
            const result = validateBackendUrl('http://example.com');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Backend URL must use HTTPS protocol for security.');
        });

        test('should reject invalid URL', () => {
            const result = validateBackendUrl('not-a-url');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Backend URL is not a valid URL.');
        });

        test('should reject empty URL', () => {
            const result = validateBackendUrl('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Backend URL cannot be empty.');
        });
    });

    describe('validateLatexContent', () => {
        const validateLatexContent = (tex) => {
            if (!tex || typeof tex !== 'string') {
                return { valid: false, error: 'LaTeX content is required.' };
            }
            const trimmedTex = tex.trim();
            if (trimmedTex.length === 0) {
                return { valid: false, error: 'LaTeX content cannot be empty.' };
            }
            return { valid: true, error: null };
        };

        test('should validate valid LaTeX content', () => {
            const result = validateLatexContent('\\documentclass{article}');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('should reject empty LaTeX content', () => {
            const result = validateLatexContent('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('LaTeX content cannot be empty.');
        });

        test('should reject null LaTeX content', () => {
            const result = validateLatexContent(null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('LaTeX content is required.');
        });
    });
});
