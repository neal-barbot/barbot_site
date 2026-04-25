import { respData } from '@/lib/resp';
import { getAllConfigs, filterPublicConfigs } from '@/modules/config/service';

const publicKeys = [
  'email_auth_enabled',
  'google_auth_enabled',
  'github_auth_enabled',
  'select_payment_enabled',
  'default_payment_provider',
  'stripe_enabled',
  'creem_enabled',
  'paypal_enabled',
  'alipay_enabled',
  'wechat_enabled',
];

export async function GET() {
  const configs = await getAllConfigs();
  const result = filterPublicConfigs(configs, publicKeys);
  result.password_reset_enabled =
    configs.email_auth_enabled !== 'false' &&
    !!configs.resend_api_key &&
    !!configs.resend_email_from
      ? 'true'
      : 'false';
  return respData(result);
}
