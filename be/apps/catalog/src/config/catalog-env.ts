import { storageEnvSchema } from '@app/storage';
import * as Joi from 'joi';

export const catalogEnvSchema: Joi.PartialSchemaMap = {
  ...storageEnvSchema,
  /** Bật/tắt consumer nhận event từ service khác (tắt khi chạy test). */
  EVENT_CONSUMERS_ENABLED: Joi.string().valid('true', 'false').default('true'),
};
