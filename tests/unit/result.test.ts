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
    });
});
