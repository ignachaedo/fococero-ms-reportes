/**
 * @fileoverview Middleware de autenticación operativa para ms-reportes.
 * Valida tokens JWT de Firebase y asigna datos del usuario autenticado a req.user.
 */

import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';

/**
 * Middleware que verifica el token Bearer de Firebase y asigna uid, email y rol a req.user.
 *
 * @param req - Objeto Request de Express
 * @param res - Objeto Response de Express
 * @param next - Función NextFunction de Express
 */
export const validateFirebaseToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                ok: false,
                error: 'Acceso denegado: Token Bearer no proporcionado.',
            });
            return;
        }

        const token = authHeader.split(' ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            rol: decodedToken.rol || 'usuario', 
        };

        next();
    } catch (_error: unknown) {
        next(_error);
    }
};
