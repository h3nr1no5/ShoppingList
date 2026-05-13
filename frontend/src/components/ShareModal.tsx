import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ShareModalProps {
  isOpen: boolean;
  shareCode: string | null;
  onClose: () => void;
  onGenerateShareLink?: () => Promise<string | null>;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  shareCode,
  onClose,
  onGenerateShareLink,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareUrl = shareCode
    ? `${window.location.origin}/shared/${shareCode}`
    : '';

  const handleCopy = async (): Promise<void> => {
    if (shareCode && shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback: select the text
        const input = document.getElementById('share-url');
        if (input) {
          (input as HTMLInputElement).select();
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    }
  };

  const handleGenerateShareLink = async (): Promise<void> => {
    if (!onGenerateShareLink) return;

    setGenerating(true);
    setGenerationError(null);

    try {
      const result = await onGenerateShareLink();
      if (result === null) {
        setGenerationError(t('share.failed_generate_share_link'));
      }
    } catch {
      setGenerationError(t('share.failed_generate_share_link'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('share.share_list')}</h2>
          <button onClick={onClose} className="modal-close">
            ×
          </button>
        </div>

        <div className="modal-content">
          {shareCode ? (
            <>
              <p className="share-info">
                {t('share.share_instructions')}
              </p>
              <div className="share-url-container">
                <input
                  id="share-url"
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="form-input share-url"
                />
                <button
                  onClick={handleCopy}
                  className="btn btn-secondary"
                >
                  {copied ? t('share.copied') : t('share.copy')}
                </button>
              </div>
            </>
          ) : onGenerateShareLink ? (
            <div className="share-generate-container">
              {generating ? (
                <p className="share-info">{t('share.generating_share_link')}</p>
              ) : (
                <>
                  <p className="share-info">
                    {t('share.share_instructions_generate')}
                  </p>
                  <button
                    onClick={handleGenerateShareLink}
                    className="btn btn-primary"
                    disabled={generating}
                  >
                    {t('share.generate_share_link')}
                  </button>
                  {generationError && (
                    <p className="share-error">{generationError}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="share-info">
              {t('share.share_not_available')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;