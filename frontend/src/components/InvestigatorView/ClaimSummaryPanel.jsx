import React from 'react';

const ClaimSummaryPanel = ({ claimInfo, disputeInfo }) => {
    return (
        <div className="claim-summary-panel">
            {disputeInfo && (
                <div className="summary-section">
                    <h3>Dispute Analysis</h3>
                    <div className="score-card">
                        <span className="score-value">
                            {disputeInfo.importanceScore ? Math.round(disputeInfo.importanceScore * 100) : 0}
                        </span>
                        <span className="score-label">Importance Score</span>
                    </div>

                    <div className="info-grid">
                        <div className="info-item">
                            <label>Phase</label>
                            <span>{disputeInfo.phase || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <label>Role</label>
                            <span>{disputeInfo.role || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            )}

            {claimInfo && (
                <div className="summary-section">
                    <h3>Claim Information</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>Patient Name</label>
                            <span>{claimInfo.patientName || 'Unknown'}</span>
                        </div>
                        <div className="info-item">
                            <label>Claim ID</label>
                            <span>{claimInfo.claimId || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <label>Policy Number</label>
                            <span>{claimInfo.policyNumber || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <label>Contract Date</label>
                            <span>{claimInfo.contractDate || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="summary-section">
                <h3>Actions</h3>
                <div className="d-grid gap-2">
                    <button className="btn btn-primary w-100 mb-2">Generate Report</button>
                    <button className="btn btn-outline-secondary w-100">Flag for Review</button>
                </div>
            </div>
        </div>
    );
};

export default ClaimSummaryPanel;
