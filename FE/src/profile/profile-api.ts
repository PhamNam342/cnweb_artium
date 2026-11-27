import type { UploadTicket } from '../artworks/types';
import { api } from '../lib/api';
import type { User } from '../lib/types';

export const AVATAR_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const profileApi = {
  avatarTicket: () =>
    api<UploadTicket>('/users/me/avatar/upload-ticket', { method: 'POST', body: {} }),
  setAvatar: (body: { publicId: string; version: number; signature: string }) =>
    api<User>('/users/me/avatar', { method: 'PUT', body }),
  removeAvatar: () => api<User>('/users/me/avatar', { method: 'DELETE' }),
};
