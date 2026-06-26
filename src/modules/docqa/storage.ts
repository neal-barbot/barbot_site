import { getAllConfigs } from '@/modules/config/service';
import { R2Provider } from '@/core/storage';
import { envConfigs } from '@/config';

async function getDocqaProvider(): Promise<R2Provider | null> {
  const configs = await getAllConfigs();
  if (!configs.r2_access_key || !configs.r2_secret_key) return null;
  return new R2Provider({
    accountId: (configs.r2_account_id as string) || '',
    accessKeyId: configs.r2_access_key as string,
    secretAccessKey: configs.r2_secret_key as string,
    bucket: envConfigs.doc_qa_bucket,
    uploadPath: 'docqa',
    region: 'auto',
    endpoint: configs.r2_endpoint as string | undefined,
    publicDomain: configs.r2_domain as string | undefined,
  });
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const provider = await getDocqaProvider();
  if (!provider) {
    throw new Error('Storage not configured — set R2 credentials in admin settings');
  }
  const result = await provider.uploadFile({ key, body, contentType, disposition: 'inline' });
  if (!result.success) {
    throw new Error(result.error ?? 'Storage upload failed');
  }
  return result.url ?? result.key ?? key;
}
