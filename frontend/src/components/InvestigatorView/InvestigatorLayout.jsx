import React, { useState, useEffect } from 'react';
import EpisodeList from './EpisodeList';
import TimelinePanel from './TimelinePanel';
import ClaimSummaryPanel from './ClaimSummaryPanel';
import './InvestigatorView.css';

const InvestigatorLayout = ({ jobId }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // API call to get investigator view data
                const response = await fetch(`/api/ocr/investigator-view/${jobId}`);
                const result = await response.json();

                if (result.success) {
                    setData(result.data);
                    // Select first episode by default if available
                    if (result.data.episodes && result.data.episodes.length > 0) {
                        setSelectedEpisodeId(result.data.episodes[0].id);
                    }
                } else {
                    setError(result.error || 'Failed to load data');
                }
            } catch (err) {
                setError('Network error: ' + err.message);
            } finally {
                setLoading(false);
            }
        };

        if (jobId) {
            fetchData();
        }
    }, [jobId]);

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <h3>Error Loading Investigator View</h3>
                <p>{error}</p>
            </div>
        );
    }

    if (!data) {
        return <div>No data available</div>;
    }

    return (
        <div className="investigator-layout">
            <header className="investigator-header">
                <div className="header-title">
                    <h1>Investigator View</h1>
                </div>
                <div className="header-controls">
                    <button className="btn btn-sm btn-light">Export Report</button>
                    <button className="btn btn-sm btn-outline-light">Settings</button>
                </div>
            </header>

            <aside className="episode-sidebar">
                <div className="sidebar-header">
                    Episodes ({data.episodes ? data.episodes.length : 0})
                </div>
                <EpisodeList
                    episodes={data.episodes || []}
                    selectedId={selectedEpisodeId}
                    onSelect={setSelectedEpisodeId}
                />
            </aside>

            <main className="timeline-panel">
                <TimelinePanel
                    events={data.timeline || []}
                    selectedEpisodeId={selectedEpisodeId}
                />
            </main>

            <aside className="claim-summary-panel">
                <ClaimSummaryPanel
                    claimInfo={data.claimInfo}
                    disputeInfo={data.disputeInfo}
                />
            </aside>
        </div>
    );
};

export default InvestigatorLayout;
