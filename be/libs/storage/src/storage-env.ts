import * as Joi from 'joi';

/** Biến môi trường Cloudinary — dùng chung cho mọi service có upload ảnh. */
export const storageEnvSchema: Joi.PartialSchemaMap = {
  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').default(''),
  CLOUDINARY_API_KEY: Joi.string().allow('').default(''),
  CLOUDINARY_API_SECRET: Joi.string().allow('').default(''),
  CLOUDINARY_FOLDER: Joi.string().default('artium'),
};
