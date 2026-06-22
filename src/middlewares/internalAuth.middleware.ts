/**
 * @fileoverview Middleware de autenticación interna para ms-reportes.
 */

import { Request, Response, NextFunction } from 'express';
import { envs } from '../config/envs';

/**
 * Middleware que valida el token interno x-internal-token.
 *
 * @param req - Objeto Request de Express
 * @param res - Objeto Response de Express
 * @param next - Función NextFunction de Express
 */
export const internalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/health' || req.path === '/metrics' || req.path === '/api/health') {
        return next();
    }

    const internalToken = req.headers['x-internal-token'];

    if (!internalToken || internalToken !== envs.INTERNAL_SECRET_TOKEN) {
        res.status(401).json({
            ok: false,
            error: 'Acceso denegado: Petición interna no autorizada.',
        });
        return;
    }

    next();
};
