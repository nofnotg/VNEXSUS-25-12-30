const ReportEditor = ({ initialContent, onSave, isSaving, lastSaved }) => {
    const [content, setContent] = React.useState(initialContent || '');
    const [isDirty, setIsDirty] = React.useState(false);

    React.useEffect(() => {
        setContent(initialContent || '');
    }, [initialContent]);

    const handleChange = (e) => {
        setContent(e.target.value);
        setIsDirty(true);
    };

    const handleSaveClick = () => {
        onSave(content);
        setIsDirty(false);
    };

    // Auto-save every 30 seconds if dirty
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (isDirty && !isSaving) {
                handleSaveClick();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [isDirty, isSaving, content]);

    return (
        <div className="report-editor-container">
            <div className="report-editor-header">
                <h3>조사 보고서 (Investigator Report)</h3>
                <div className="report-editor-controls">
                    <span className="save-status">
                        {isSaving ? '저장 중...' : lastSaved ? `마지막 저장: ${new Date(lastSaved).toLocaleTimeString()}` : ''}
                    </span>
                    <button
                        className="btn-save"
                        onClick={handleSaveClick}
                        disabled={!isDirty || isSaving}
                    >
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
            <div className="report-editor-body">
                <textarea
                    className="report-textarea"
                    value={content}
                    onChange={handleChange}
                    placeholder="보고서 내용이 여기에 표시됩니다..."
                />
            </div>
        </div>
    );
};

window.ReportEditor = ReportEditor;
