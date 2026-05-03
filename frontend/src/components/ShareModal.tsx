import React, { useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  shareCode: string | null;
  isPublic: boolean;
  onClose: () => void;
  onTogglePublic: (isPublic: boolean) => void;
  onGenerateShareLink?: () => Promise<string | null>;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  shareCode,
  isPublic,
  onClose,
  onTogglePublic,
  onGenerateShareLink,
}) => {
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
        setGenerationError('Failed to generate share link. Please try again.');
      }
    } catch {
      setGenerationError('Failed to generate share link. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Share List</h2>
          <button onClick={onClose} className="modal-close">
            ×
          </button>
        </div>

        <div className="modal-content">
          {shareCode ? (
            <>
              <p className="share-info">
                Share this link to let others view your shopping list:
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
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <label className="form-checkbox-label share-toggle">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => onTogglePublic(e.target.checked)}
                />
                <span>Make this list public</span>
              </label>
            </>
          ) : onGenerateShareLink ? (
            <div className="share-generate-container">
              {generating ? (
                <p className="share-info">Generating share link...</p>
              ) : (
                <>
                  <p className="share-info">
                    Generate a share link to let others view your shopping list.
                  </p>
                  <button
                    onClick={handleGenerateShareLink}
                    className="btn btn-primary"
                    disabled={generating}
                  >
                    Generate Share Link
                  </button>
                  {generationError && (
                    <p className="share-error">{generationError}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="share-info">
              Share link is not available for this list.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;