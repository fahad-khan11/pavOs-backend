import jwt from 'jsonwebtoken';
import { CONSTANTS } from '../config/constants.js';
import { JWTPayload } from '../types/index.js';

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, CONSTANTS.JWT_SECRET, {
    expiresIn: CONSTANTS.JWT_EXPIRE,
  } as any);
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, CONSTANTS.JWT_REFRESH_SECRET, {
    expiresIn: CONSTANTS.JWT_REFRESH_EXPIRE,
  } as any);
};

export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, CONSTANTS.JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, CONSTANTS.JWT_REFRESH_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
};
