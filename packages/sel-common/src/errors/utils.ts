type ErrorWithCaptureStackTrace = typeof Error & {
	captureStackTrace: (target: object, constructor: unknown) => void;
};

/**
 * Type guard to check if the Error constructor has the captureStackTrace method.
 *
 * @param error
 */
export const hasCaptureStackTrace = (
	error: typeof Error,
): error is ErrorWithCaptureStackTrace => "captureStackTrace" in error;
