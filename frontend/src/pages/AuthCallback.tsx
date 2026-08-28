import { useEffect, useState } from 'react';
import { authApi } from '@/lib/auth';
import { FactoryPage } from '@/page-factory/FactoryPage';

export default function AuthCallback() {
  const [message, setMessage] = useState('正在处理登录结果...');

  useEffect(() => {
    const completed = authApi.completeCallbackFromUrl();

    if (!completed) {
      setMessage('未检测到登录凭证，正在返回首页...');
      window.setTimeout(() => {
        window.location.href = '/kh';
      }, 1200);
      return;
    }

    const returnTo =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem('tradepro.auth.returnTo')
        : null;

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('tradepro.auth.returnTo');
    }

    setMessage('登录成功，正在进入系统...');
    window.setTimeout(() => {
      window.location.href = returnTo || '/kh';
    }, 150);
  }, []);

  return (
    <FactoryPage pageId="auth-callback" template="form" sourceScope="client_source" autoRegions>
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p data-page-factory-region="title-2" className="text-gray-600">{message}</p>
      </div>
    </div>
    </FactoryPage>
  );
}
