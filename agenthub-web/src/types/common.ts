export type Result<T> = {
  success: boolean;
  errorMsg?: string;
  data?: T;
  total?: number;
};
