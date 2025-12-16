/**
 * Result Type - Rust-inspired error handling
 * 
 * Use this instead of throwing exceptions for expected errors.
 */

export type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

/**
 * Create a successful result
 */
export function Ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

/**
 * Check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
    return result.ok;
}

/**
 * Check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return !result.ok;
}

/**
 * Unwrap a result, throwing if it's an error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (result.ok) {
        return result.value;
    }
    throw result.error;
}

/**
 * Unwrap a result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (result.ok) {
        return result.value;
    }
    return defaultValue;
}

/**
 * Map the value of a result
 */
export function mapResult<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
): Result<U, E> {
    if (result.ok) {
        return Ok(fn(result.value));
    }
    return result;
}

/**
 * Wrap a promise to return a Result
 */
export async function tryCatch<T>(
    promise: Promise<T>
): Promise<Result<T, Error>> {
    try {
        const value = await promise;
        return Ok(value);
    } catch (error) {
        return Err(error instanceof Error ? error : new Error(String(error)));
    }
}
