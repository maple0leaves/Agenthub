export type UserProfile = {
  id: number;
  nickName: string;
  icon?: string;
};

export type UserLite = {
  id: number;
  nickName: string;
  icon?: string;
};

export type UserInfo = {
  userId?: number;
  city?: string;
  introduce?: string;
  fans?: number;
  followee?: number;
  gender?: number;
};
