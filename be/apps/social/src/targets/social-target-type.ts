/** Loại đối tượng mà like / bình luận trỏ tới. Khớp enum social_target_type trong social_db. */
export enum SocialTargetType {
  Artwork = 'artwork',
  Moment = 'moment',
  Comment = 'comment',
  Moodboard = 'moodboard',
  Review = 'review',
}

export const SOCIAL_TARGET_TYPES = Object.values(SocialTargetType);
