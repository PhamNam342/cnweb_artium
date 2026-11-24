import { UserResponse } from '../../users/user.mapper';

export class AuthResponse {
  accessToken!: string;
  /** Số giây access token còn hiệu lực. */
  expiresIn!: number;
  tokenType!: 'Bearer';
  user!: UserResponse;
}

export class MessageResponse {
  message!: string;
}
