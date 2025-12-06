import React from 'react';

const TimelinePanel = ({ events, selectedEpisodeId }) => {
    // Filter events if an episode is selected, or show all?
    // Usually we show all but highlight, or filter. Let's filter for now.
    const filteredEvents = selectedEpisodeId
        ? events.filter(e => e.episodeId === selectedEpisodeId)
        : events;

    // Sort by date
    const sortedEvents = [...filteredEvents].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    if (!sortedEvents || sortedEvents.length === 0) {
        return (
            <div className="timeline-panel">
                <div className="text-center p-8 text-gray-500">
                    No events to display for this selection.
                </div>
            </div>
        );
    }

    return (
        <div className="timeline-panel">
            <div className="timeline-container">
                {sortedEvents.map((event, index) => (
                    <div key={event.id || index} className="timeline-event">
                        <div className="event-marker"></div>
                        <div className="event-card">
                            <div className="event-header">
                                <span className="event-date">{event.date}</span>
                                <span className="event-type">{event.type}</span>
                            </div>
                            <div className="event-content">
                                <h3>{event.summary}</h3>
                                <div className="event-details">
                                    {event.details}
                                </div>
                                {event.hospital && (
                                    <div className="mt-2 text-sm text-gray-600">
                                        🏥 {event.hospital}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimelinePanel;
