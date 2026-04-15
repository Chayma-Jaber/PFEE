import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom parameter decorator to extract the current authenticated user
 * from the request object.
 *
 * Usage:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: User) { ... }
 *
 *   @Get('profile')
 *   getUserId(@CurrentUser('id') userId: number) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
