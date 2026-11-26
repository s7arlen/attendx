import jwt from 'jsonwebtoken';
import { getJwtSecret, getJwtRefreshSecret } from './security';

interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getJwtRefreshSecret(), {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtRefreshSecret(), {
    algorithms: ['HS256'],
  }) as TokenPayload;
};
