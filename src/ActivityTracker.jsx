import React from 'react';
import ScreenCaptureService from './services/ScreenCaptureService.js';
import './ActivityTracker.css';

class ActivityTracker extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isCapturing: false,
            screenshots: []  // Store captured screenshots here
        };
        this.captureService = new ScreenCaptureService();
    }

    handleStartCapturingScreenshots = () => {
        this.setState({ isCapturing: true });
        this.captureService.startRandomScreenshotInterval(this.displayScreenshots);
    }

    handleStopCapturingScreenshots = () => {
        this.setState({ isCapturing: false });
        this.captureService.stopRandomScreenshotInterval();
    }

    // Display captured screenshots in the UI
    displayScreenshots = (screenshots) => {
        const currentScreenshots = this.state.screenshots;
        currentScreenshots.push(...screenshots);
        this.setState({ screenshots: currentScreenshots });
    }

    render() {
        const { isCapturing, screenshots } = this.state;

        return (
            <div className="screen-capture-ui">
                <h2>Screen Capture</h2>

                <div className="controls">
                    <button onClick={this.handleStartCapturingScreenshots} disabled={isCapturing}>
                        Start Capturing Screenshots
                    </button>
                    <button onClick={this.handleStopCapturingScreenshots} disabled={!isCapturing}>
                        Stop Capturing Screenshots
                    </button>
                </div>

                {screenshots.length > 0 && (
                    <div className="screenshots-container">
                        <h3>Captured Screenshots:</h3>
                        <div className="screenshots-grid">
                            {screenshots.map((screenshot, index) => (
                                <div key={index} className="screenshot-item">
                                    <img src={screenshot} alt={`Screenshot ${index + 1}`} />
                                    <p>Screenshot {index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default ActivityTracker;
