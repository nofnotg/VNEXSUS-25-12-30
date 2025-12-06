import React from 'react';

const EpisodeList = ({ episodes, selectedId, onSelect }) => {
    if (!episodes || episodes.length === 0) {
        return <div className="p-4 text-gray-500">No episodes found.</div>;
    }

    return (
        <div className="episode-list">
            {episodes.map(episode => (
                <div
                    key={episode.id}
                    className={`episode-item ${selectedId === episode.id ? 'selected' : ''}`}
                    onClick={() => onSelect(episode.id)}
                >
                    <div className="episode-date">
                        {episode.startDate} {episode.endDate ? ` - ${episode.endDate}` : ''}
                    </div>
                    <div className="episode-title">
                        {episode.primaryDiagnosis || 'Unknown Diagnosis'}
                    </div>
                    <div className="episode-hospital">
                        {episode.hospitals ? episode.hospitals.join(', ') : 'Unknown Hospital'}
                    </div>

                    {episode.tags && episode.tags.length > 0 && (
                        <div className="episode-tags">
                            {episode.tags.map((tag, index) => (
                                <span key={index} className={`tag ${tag.type === 'dispute' ? 'dispute' : ''}`}>
                                    {tag.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default EpisodeList;
