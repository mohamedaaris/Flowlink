import { useState, useEffect } from 'react';
import './DownloadPage.css';

interface Release {
  tag_name: string;
  name: string;
  body: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
  published_at: string;
}

export default function DownloadPage() {
  const [latestRelease, setLatestRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestRelease();
  }, []);

  const fetchLatestRelease = async () => {
    try {
      const response = await fetch('https://api.github.com/repos/YOUR_USERNAME/Flowlink/releases/latest');
      const release = await response.json();
      setLatestRelease(release);
    } catch (error) {
      console.error('Failed to fetch latest release:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="download-page">
        <div className="loading">Loading latest version...</div>
      </div>
    );
  }

  const apkAsset = latestRelease?.assets.find(asset => asset.name.endsWith('.apk'));

  return (
    <div className="download-page">
      <div className="download-container">
        <h1>📱 Download FlowLink Mobile</h1>
        
        {latestRelease && apkAsset ? (
          <div className="download-section">
            <div className="version-info">
              <h2>{latestRelease.name}</h2>
              <p className="release-date">
                Released: {new Date(latestRelease.published_at).toLocaleDateString()}
              </p>
            </div>

            <div className="download-button-container">
              <a 
                href={apkAsset.browser_download_url}
                className="download-button"
                download
              >
                📥 Download APK ({formatFileSize(apkAsset.size)})
              </a>
            </div>

            <div className="installation-guide">
              <h3>📋 Installation Instructions</h3>
              <ol>
                <li>Download the APK file above</li>
                <li>On your Android device, go to <strong>Settings → Security</strong></li>
                <li>Enable <strong>"Install from unknown sources"</strong> or <strong>"Allow from this source"</strong></li>
                <li>Open the downloaded APK file</li>
                <li>Tap <strong>"Install"</strong></li>
                <li>Open FlowLink and start connecting your devices!</li>
              </ol>
            </div>

            <div className="system-requirements">
              <h3>📋 System Requirements</h3>
              <ul>
                <li>Android 7.0+ (API level 24)</li>
                <li>Internet connection for device pairing</li>
                <li>~{formatFileSize(apkAsset.size)} storage space</li>
              </ul>
            </div>

            {latestRelease.body && (
              <div className="release-notes">
                <h3>📝 What's New</h3>
                <div className="release-body">
                  {latestRelease.body.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="no-release">
            <p>No APK available yet. Check back soon!</p>
          </div>
        )}

        <div className="qr-section">
          <h3>📱 Quick Access</h3>
          <p>Bookmark this page or scan QR code:</p>
          <div className="qr-placeholder">
            {/* You can generate a QR code for this page URL */}
            <p>🔗 flowlink.your-domain.com/download</p>
          </div>
        </div>
      </div>
    </div>
  );
}