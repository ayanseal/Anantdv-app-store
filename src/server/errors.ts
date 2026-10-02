export class AppError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export const unauthorized = () => new AppError('UNAUTHORIZED', 401, 'Please sign in again.');
export const forbidden = () => new AppError('FORBIDDEN', 403, 'You do not have access to this resource.');
