import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  /** Hash giả để so sánh khi user không tồn tại => thời gian phản hồi như nhau (chống dò email). */
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(
    hash: string | null | undefined,
    plain: string,
  ): Promise<boolean> {
    if (!hash) {
      this.dummyHash ??= this.hash('dummy-password-for-timing');
      await argon2.verify(await this.dummyHash, plain).catch(() => false);
      return false;
    }
    return argon2.verify(hash, plain).catch(() => false);
  }
}
