import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function TestClaude() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-3-opus-20240229');
  const [prompt, setPrompt] = useState('');
  const [maxTokens, setMaxTokens] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState('');
  const [csvData, setCsvData] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse('');
    setCsvData('');

    try {
      const res = await fetch('/api/test-claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          model,
          prompt,
          maxTokens,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to call API');
      }

      setResponse(data.response);
      setCsvData(data.csvData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!csvData) return;
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-response-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Claude API 테스트</title>
        <meta name="description" content="Claude API 테스트 페이지" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Claude API 테스트</h1>

        <div className={styles.form}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="apiKey">API Key:</label>
              <input
                id="apiKey"
                type="password"
                className={styles.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="model">모델:</label>
              <select
                id="model"
                className={styles.input}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="maxTokens">최대 토큰 수:</label>
              <input
                id="maxTokens"
                type="number"
                className={styles.input}
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                min="1"
                max="200000"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="prompt">프롬프트:</label>
              <textarea
                id="prompt"
                className={styles.textarea}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows="10"
                required
              />
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading ? '요청 중...' : '요청 보내기'}
            </button>
          </form>

          {error && <div className={styles.error}>{error}</div>}

          {response && (
            <div className={styles.responseSection}>
              <h2>응답:</h2>
              <pre className={styles.responseDisplay}>{response}</pre>
              
              <div className={styles.downloadSection}>
                <button
                  onClick={handleDownload}
                  className={styles.downloadButton}
                >
                  CSV 다운로드
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 