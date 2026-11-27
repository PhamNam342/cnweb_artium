import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { DiscoverPage } from '../discover/DiscoverPage';
import { ApiError } from '../lib/api';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { AppLayout } from '../studio/StudioLayout';

/** Trang chính sau đăng nhập = Khám phá (+ nhắc xác minh email, popup onboarding lần đầu). */
export function HomePage() {
  const { user, resendVerification } = useAuth();
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  if (!user) return null;

  async function onResend() {
    try {
      await resendVerification();
      setVerifyMsg('Đã gửi lại email xác minh.');
    } catch (e) {
      setVerifyMsg(e instanceof ApiError ? e.message : 'Không gửi được, thử lại sau.');
    }
  }

  return (
    <>
      <AppLayout wide>
        <div aria-hidden={!user.onboardingCompleted || undefined}>
          {!user.emailVerified && (
            <div className="banner banner--inline" role="status">
              <span>
                {verifyMsg ?? `Hãy xác minh email ${user.email} để dùng đầy đủ tính năng mua bán.`}
              </span>
              {!verifyMsg && (
                <button
                  type="button"
                  className="btn btn--sm btn--outline"
                  onClick={() => void onResend()}
                >
                  Gửi lại email
                </button>
              )}
            </div>
          )}
          <DiscoverPage />
        </div>
      </AppLayout>
      {!user.onboardingCompleted && <OnboardingModal user={user} />}
    </>
  );
}
