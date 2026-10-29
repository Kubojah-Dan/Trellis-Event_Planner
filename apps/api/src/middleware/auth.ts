import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import { env } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      actor?: {
        uid: string;
        email?: string;
        displayName?: string;
      };
    }
  }
}

export interface TokenVerifier {
  verifyIdToken(token: string): Promise<{ uid: string; email?: string; name?: string }>;
}

let activeTokenVerifier: TokenVerifier = {
  async verifyIdToken(token: string) {
    // In test or local emulator mode, accept simulated deterministic tokens for automated testing
    if (env.NODE_ENV === 'test' || env.USE_FIREBASE_EMULATOR) {
      if (token.startsWith('mock-token-') || token.startsWith('test-token-')) {
        const uid = token.replace(/^(mock|test)-token-/, '');
        return { uid, email: `${uid}@example.com`, name: `Test User ${uid}` };
      }
    }

    try {
      // Lazy load firebase-admin to avoid startup errors if credentials are not configured
      const { getFirebaseAuth } = await import('../infrastructure/firebase-admin');
      const auth = getFirebaseAuth();
      const decoded = await auth.verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      };
    } catch (_err: any) {
      throw new AppError(401, 'INVALID_AUTH_TOKEN', 'The provided authentication token is invalid or expired.');
    }
  },
};

export function setTokenVerifier(verifier: TokenVerifier) {
  activeTokenVerifier = verifier;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header.'));
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Bearer token is missing.'));
    return;
  }

  try {
    const actor = await activeTokenVerifier.verifyIdToken(token);
    req.actor = {
      uid: actor.uid,
      email: actor.email,
      displayName: actor.name,
    };
    next();
  } catch (error) {
    next(error);
  }
}
