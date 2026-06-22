/**
 * @fileoverview Middleware de autorización basada en roles para ms-reportes.
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/user.enum';

/**
 * Middleware que verifica que el rol del usuario esté en la lista de roles permitidos.
 *
 * @param allowedRoles - Lista de roles permitidos
 * @returns Middleware function de Express
 */
export const authorizeRole = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;

        if (!user) {
            res.status(401).json({
                ok: false,
                msg: 'Acceso denegado: Identidad no verificada.',
            });
            return;
        }

        if (!allowedRoles.includes(user.rol as UserRole)) {
            res.status(403).json({
                ok: false,
                msg: `Acceso denegado: Requiere nivel de privilegio superior. Tu rol actual es '${user.rol}'.`,
            });
            return;
        }

        next();
    };
};
