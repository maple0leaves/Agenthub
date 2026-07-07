/** Agent评测社区帖子 */
export type BlogPost = {
  id: number;
  userId: number;
  title?: string;
  content?: string; // 使用心得
  images?: string;
  liked?: number;
  comments?: number;
  name?: string;
  icon?: string;
  isLike?: boolean;
  createTime?: string;
};

export type BlogFeedResponse = {
  list?: BlogPost[];
  minTime?: number;
  offset?: number;
};

export type BlogComment = {
  id: number;
  blogId: number;
  parentId?: number;
  userId?: number;
  content: string;
  liked?: number;
  isLiked?: boolean;
  userName?: string;
  userIcon?: string;
  createTime?: string;
};
