import * as Joi from 'joi';

/** Biến môi trường chung của mọi service có database. */
export const baseEnvSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().required(),
  WEB_ORIGIN: Joi.string().default('http://localhost:5173'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DB_MIGRATIONS_RUN: Joi.string().valid('true', 'false').default('false'),
  DB_LOGGING: Joi.string().valid('true', 'false').default('false'),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  OUTBOX_RELAY_ENABLED: Joi.string().valid('true', 'false').default('true'),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(100).default(1000),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
});
