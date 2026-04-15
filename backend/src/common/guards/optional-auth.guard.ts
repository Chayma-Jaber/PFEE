import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that attempts JWT authentication but does NOT throw if
 * no token is present. If a valid token is provided, request.user
 * is populated. Otherwise request.user is set to null.
 *
 * Useful for endpoints that behave differently for authenticated
 * vs anonymous users (e.g., showing personalized prices).
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    // Do not throw -- return null if authentication fails
    return user || null;
  }
}
