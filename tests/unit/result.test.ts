/**
 * Unit tests for the Result utility
 */
import { describe, it, expect } from 'bun:test';
import { Ok, Err, isOk, isErr, unwrap, unwrapOr, mapResult, tryCatch } from '../../packages/core/src/utils/result';

describe('Result utility', () => {
    describe('Ok', () => {
        it('should create a successful result', () => {
            const result = Ok(42);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(42);
            }
        });
    });

    describe('Err', () => {
        it('should create an error result', () => {
            const result = Err(new Error('test error'));
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('test error');
            }
        });
    });

    describe('isOk', () => {
        it('should return true for Ok', () => {
            expect(isOk(Ok(1))).toBe(true);
        });

        it('should return false for Err', () => {
            expect(isOk(Err('error'))).toBe(false);
        });
    });

    describe('isErr', () => {
        it('should return true for Err', () => {
            expect(isErr(Err('error'))).toBe(true);
        });

        it('should return false for Ok', () => {
            expect(isErr(Ok(1))).toBe(false);
        });
    });

    describe('unwrap', () => {
        it('should return value for Ok', () => {
            expect(unwrap(Ok(42))).toBe(42);
        });

        it('should throw for Err', () => {
            expect(() => unwrap(Err(new Error('test')))).toThrow('test');
        });
    });

    describe('unwrapOr', () => {
        it('should return value for Ok', () => {
            expect(unwrapOr(Ok(42), 0)).toBe(42);
        });

        it('should return default for Err', () => {
            expect(unwrapOr(Err('error'), 0)).toBe(0);
        });
    });

    describe('mapResult', () => {
        it('should map Ok value', () => {
            const result = mapResult(Ok(2), x => x * 3);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(6);
            }
        });

        it('should pass through Err', () => {
            const result = mapResult(Err('error'), x => x * 3);
            expect(result.ok).toBe(false);
        });
    });

    describe('tryCatch', () => {
        it('should return Ok for successful promise', async () => {
            const result = await tryCatch(Promise.resolve(42));
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(42);
            }
        });

        it('should return Err for rejected promise', async () => {
            const result = await tryCatch(Promise.reject(new Error('async error')));
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('async error');
            }
        });

        it('should handle non-Error rejections', async () => {
            const result = await tryCatch(Promise.reject('string error'));
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeInstanceOf(Error);
                expect(result.error.message).toBe('string error');
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle null values in Ok', () => {
            const result = Ok(null);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(null);
            }
        });

        it('should handle undefined values in Ok', () => {
            const result = Ok(undefined);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(undefined);
            }
        });

        it('should handle complex objects', () => {
            const obj = { nested: { value: 42 } };
            const result = Ok(obj);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.nested.value).toBe(42);
            }
        });

        it('should handle arrays', () => {
            const arr = [1, 2, 3];
            const result = Ok(arr);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toEqual([1, 2, 3]);
            }
        });
    });

    describe('Error Handling', () => {
        it('should preserve error types', () => {
            class CustomError extends Error {
                constructor(message: string) {
                    super(message);
                    this.name = 'CustomError';
                }
            }
            
            const result = Err(new CustomError('custom'));
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeInstanceOf(CustomError);
                expect(result.error.name).toBe('CustomError');
            }
        });

        it('should handle string errors', () => {
            const result = Err('simple error');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe('simple error');
            }
        });
    });

    describe('Integration', () => {
        it('should chain multiple operations', () => {
            const result = mapResult(
                mapResult(Ok(2), x => x * 2),
                x => x + 1
            );
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(5);
            }
        });

        it('should short-circuit on first error', () => {
            const result = mapResult(
                mapResult(Err('error'), x => x * 2),
                x => x + 1
            );
            expect(result.ok).toBe(false);
        });

        it('should work with async operations', async () => {
            const fetchData = async (id: number) => {
                if (id > 0) return id * 10;
                throw new Error('Invalid ID');
            };

            const result1 = await tryCatch(fetchData(5));
            expect(unwrapOr(result1, 0)).toBe(50);

            const result2 = await tryCatch(fetchData(-1));
            expect(unwrapOr(result2, 0)).toBe(0);
        });
    });
});
