import React from 'react';
const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');

class ScreenCapture extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isRecording: false,
            recordedChunks: [],
            videoBlob: null,
            selectedCodec: '',
            codecs: [
                { id: 'vp8', name: 'VP8', mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
                { id: 'vp9', name: 'VP9', mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
                { id: 'av1', name: 'AV1', mimeType: 'video/webm;codecs=av1', extension: 'webm' },
                { id: 'h264', name: 'H.264 (AVC)', mimeType: 'video/mp4;codecs=h264', extension: 'mp4' },
                { id: 'h265', name: 'H.265 (HEVC)', mimeType: 'video/mp4;codecs=hevc', extension: 'mp4' },
                { id: 'mpeg4', name: 'MPEG-4 Part 2', mimeType: 'video/mp4;codecs=mp4v', extension: 'mp4' },
                { id: 'mjpeg', name: 'Motion JPEG', mimeType: 'video/webm;codecs=mjpeg', extension: 'webm' },
                { id: 'wmv', name: 'Windows Media Video', mimeType: 'video/x-ms-wmv', extension: 'wmv' },
                { id: 'theora', name: 'Theora', mimeType: 'video/ogg;codecs=theora', extension: 'ogv' }
            ],
            error: null,
            videoDetails: null,
            usedCodec: null,
            videoQuality: 'high',
            frameRate: 30,
            fileName: 'screen_capture',
            isSaving: false,
            saveMessage: '',
            snapshotBlob: null,
            snapshotFileName: 'snapshot',
        };
        this.mediaRecorder = null;
    }

    componentDidMount() {
        this.checkSupportedCodecs();
    }

    checkSupportedCodecs = () => {
        const updatedCodecs = this.state.codecs.map(codec => ({
            ...codec,
            isSupported: MediaRecorder.isTypeSupported(codec.mimeType)
        }));
        this.setState({ codecs: updatedCodecs });
    }

    handleFileNameChange = (event) => {
        this.setState({ fileName: event.target.value });
    }

    handleCodecChange = (event) => {
        this.setState({ selectedCodec: event.target.value });
    }

    handleQualityChange = (event) => {
        this.setState({ videoQuality: event.target.value });
    }

    handleFrameRateChange = (event) => {
        this.setState({ frameRate: parseInt(event.target.value, 10) });
    }

    getBitrate(quality) {
        switch (quality) {
            case 'low': return 1000000; // 1 Mbps
            case 'medium': return 2500000; // 2.5 Mbps
            case 'high': return 5000000; // 5 Mbps
            default: return 2500000;
        }
    }

    startCapture = async () => {
        try {
            console.log('Starting screen capture');
            const sources = await ipcRenderer.invoke('get-sources');
            console.log("Sources:", sources);
            const selectedSource = await this.selectSource(sources);
            if (!selectedSource) return;

            const constraints = {
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSource.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            const selectedCodec = this.state.codecs.find(c => c.id === this.state.selectedCodec);
            let options = {
                videoBitsPerSecond: this.getBitrate(this.state.videoQuality),
                frameRate: this.state.frameRate
            };
            let usedCodec = selectedCodec;

            if (selectedCodec && MediaRecorder.isTypeSupported(selectedCodec.mimeType)) {
                options.mimeType = selectedCodec.mimeType;
            } else {
                console.warn(`${selectedCodec ? selectedCodec.name : 'Selected codec'} is not supported. Falling back to default codec.`);
                this.setState({ error: `${selectedCodec ? selectedCodec.name : 'Selected codec'} is not supported. Using default codec.` });
                usedCodec = null;
            }

            this.mediaRecorder = new MediaRecorder(stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.setState(prevState => ({
                        recordedChunks: [...prevState.recordedChunks, event.data]
                    }));
                }
            };

            this.mediaRecorder.onstop = () => {
                this.setState(prevState => {
                    const videoBlob = new Blob(prevState.recordedChunks, {
                        type: usedCodec ? usedCodec.mimeType : 'video/webm'
                    });
                    this.getVideoDetails(videoBlob, usedCodec);
                    return { isRecording: false, videoBlob, usedCodec };
                });
            };

            this.mediaRecorder.start();
            this.setState({
                isRecording: true,
                error: null,
                videoDetails: null,
                videoBlob: null,
                usedCodec,
                recordedChunks: []
            });
        } catch (err) {
            this.setState({ error: "Error starting screen capture: " + err.message });
        }
    }

    getVideoDetails = (blob, usedCodec) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            const details = {
                size: (blob.size / (1024 * 1024)).toFixed(2) + ' MB',
                type: blob.type,
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                duration: video.duration.toFixed(2) + ' seconds',
            };
            this.setState({ videoDetails: details, usedCodec });
        };
        video.src = URL.createObjectURL(blob);
    }

    selectSource = (sources) => {
        return new Promise((resolve) => {
            ipcRenderer.invoke('show-source-selection', sources).then((selectedSource) => {
                resolve(selectedSource);
            });
        });
    }

    stopCapture = () => {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
    }

    downloadVideo = async () => {
        if (this.state.videoBlob) {
            this.setState({ isSaving: true, saveMessage: 'Preparing file for download...' });

            const extension = this.state.usedCodec ? this.state.usedCodec.extension : 'webm';
            const fullFileName = `${this.state.fileName}.${extension}`;

            try {
                const filePath = await ipcRenderer.invoke('save-file-dialog', fullFileName);

                if (filePath) {
                    const buffer = await this.state.videoBlob.arrayBuffer();
                    await ipcRenderer.invoke('save-file', filePath, buffer);
                    this.setState({ saveMessage: 'File saved successfully!', isSaving: false });
                } else {
                    this.setState({ saveMessage: 'File save cancelled.', isSaving: false });
                }
            } catch (err) {
                console.error('Error saving file:', err);
                this.setState({ saveMessage: 'Error saving file. Please try again.', isSaving: false });
            }
        }
    }

    takeSnapshot = async () => {
        try {
            const sources = await ipcRenderer.invoke('get-sources');
            
            const selectedSource = await this.selectSource(sources);
            if (!selectedSource) return;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSource.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                }
            });

            const track = stream.getVideoTracks()[0];

            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();

            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d');
            context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

            canvas.toBlob((blob) => {
                this.setState({ snapshotBlob: blob });
            }, 'image/png');

            track.stop();
        } catch (error) {
            this.setState({ error: "Error taking snapshot: " + error.message });
        }
    }

    downloadSnapshot = async () => {
        if (this.state.snapshotBlob) {
            const filePath = await ipcRenderer.invoke('save-file-dialog', `${this.state.snapshotFileName}.png`);

            if (filePath) {
                const buffer = await this.state.snapshotBlob.arrayBuffer();
                try {
                    await ipcRenderer.invoke('save-file', filePath, buffer);
                    this.setState({ saveMessage: 'Snapshot saved successfully!' });
                } catch (err) {
                    this.setState({ saveMessage: 'Error saving snapshot. Please try again.' });
                }
            } else {
                this.setState({ saveMessage: 'Snapshot save cancelled.' });
            }
        }
    }

    handleSnapshotFileNameChange = (event) => {
        this.setState({ snapshotFileName: event.target.value });
    }
    render() {
        const { isRecording, selectedCodec, codecs, error, videoDetails, usedCodec, videoBlob, videoQuality, frameRate, fileName, isSaving, saveMessage, snapshotBlob, snapshotFileName } = this.state;
        return (
            <div className="screen-capture">
                <h2>Screen Capture</h2>
                {error && <div className="error">{error}</div>}
                <div className="codec-selection">
                    <label htmlFor="codec">Compression Codec:</label>
                    <select
                        id="codec"
                        value={selectedCodec}
                        onChange={this.handleCodecChange}
                    >
                        <option value="">Select a codec</option>
                        {codecs.map(codec => (
                            <option
                                key={codec.id}
                                value={codec.id}
                                disabled={!codec.isSupported}
                            >
                                {codec.name} {!codec.isSupported ? '(Not supported)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="compression-settings">
                    <div>
                        <label htmlFor="quality">Video Quality:</label>
                        <select
                            id="quality"
                            value={videoQuality}
                            onChange={this.handleQualityChange}
                        >
                            <option value="low">Low (640x480)</option>
                            <option value="medium">Medium (1280x720)</option>
                            <option value="high">High (1920x1080)</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="frameRate">Frame Rate:</label>
                        <input
                            type="number"
                            id="frameRate"
                            value={frameRate}
                            onChange={this.handleFrameRateChange}
                            min="1"
                            max="60"
                        />
                    </div>
                </div>
                <div className="controls">
                    <button onClick={this.startCapture} disabled={isRecording}>
                        Start Capture
                    </button>
                    <button onClick={this.stopCapture} disabled={!isRecording}>
                        Stop Capture
                    </button>
                </div>
                {videoDetails && videoBlob && (
                    <div className="video-details">
                        <h3>Video Details:</h3>
                        <p>Size: {videoDetails.size}</p>
                        <p>Type: {videoDetails.type}</p>
                        <p>Resolution: {videoDetails.resolution}</p>
                        <p>Duration: {videoDetails.duration}</p>
                        <p>Used Codec: {usedCodec ? usedCodec.name : 'Default'}</p>
                        <p>Quality Setting: {videoQuality}</p>
                        <p>Frame Rate: {frameRate} fps</p>
                        <div className="file-save-options">
                            <label htmlFor="fileName">File Name:</label>
                            <input
                                type="text"
                                id="fileName"
                                value={fileName}
                                onChange={this.handleFileNameChange}
                                disabled={isSaving}
                            />
                            <button onClick={this.downloadVideo} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Video'}
                            </button>
                        </div>
                        {saveMessage && <p className="save-message">{saveMessage}</p>}
                    </div>
                )}

                <div className="snapshot-controls">
                    <button onClick={this.takeSnapshot}>
                        Take Snapshot
                    </button>
                </div>

                {snapshotBlob && (
                    <div className="snapshot-details">
                        <h3>Snapshot:</h3>
                        <img src={URL.createObjectURL(snapshotBlob)} alt="Snapshot" style={{ maxWidth: '100%', height: 'auto' }} />
                        <div className="file-save-options">
                            <label htmlFor="snapshotFileName">Snapshot File Name:</label>
                            <input
                                type="text"
                                id="snapshotFileName"
                                value={snapshotFileName}
                                onChange={this.handleSnapshotFileNameChange}
                            />
                            <button onClick={this.downloadSnapshot}>
                                Save Snapshot
                            </button>
                        </div>
                    </div>
                )}
                <button onClick={() => window.location.href = '/'} className="audio-capture-link">
                    Go to Usage Tracker
                </button>
                <button onClick={() => window.location.href = '/audiocapture'} className="screen-capture-link">
                Go to Audio Capture
            </button>
            </div>
        );
    }
}

export default ScreenCapture;