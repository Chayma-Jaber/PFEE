import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access an endpoint.
 *
 * Usage:
 *   @Roles('admin')
 *   @Roles('admin', 'moderator')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
