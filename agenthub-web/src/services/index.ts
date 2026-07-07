import { agentApi } from './agentApi';
import { aiApi } from './aiApi';
import { blogApi } from './blogApi';
import { followApi } from './followApi';
import { uploadApi } from './uploadApi';
import { userApi } from './userApi';
import { voucherApi } from './voucherApi';

export const api = {
  ...userApi,
  ...agentApi,
  ...followApi,
  ...blogApi,
  ...voucherApi,
  ...uploadApi,
  ...aiApi,
};

export { clearToken, getToken, setToken } from './base';
