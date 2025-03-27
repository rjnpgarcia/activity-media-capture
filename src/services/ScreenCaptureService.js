const { ipcRenderer } = window.require('electron');

export default class ScreenCaptureService {
    constructor() {
        this.mediaRecorder = null;
        this.stream = null;
        this.recordedChunks = [];
        this.codecs = [
            { id: 'vp8', name: 'VP8', mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
            { id: 'vp9', name: 'VP9', mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
            { id: 'av1', name: 'AV1', mimeType: 'video/webm;codecs=av1', extension: 'webm' },
            { id: 'mpeg4', name: 'MPEG-4 Part 2', mimeType: 'video/mp4;codecs=mp4v', extension: 'mp4' }
        ];
        this.selectedCodec = null;
        this.videoQuality = 'high';
        this.frameRate = 30;
        this.randomInterval = null;
        this.timeoutId = null;
    }

    // Get available codecs
    get AvailableCodecs() {
        return this.codecs;
    }

    ///// FOR SCREENSHOTS /////
   // Request the main process to take screenshots of all screens
   async takeSnapshotAllScreens() {
    const screenshots = await ipcRenderer.invoke('capture-all-screens');
    return screenshots;  // Array of base64-encoded screenshots (Data URLs)
}

    // Random interval between 1 and 5 minutes to take screenshots
    startRandomScreenshotInterval(callback) {
        const takeScreenshot = async () => {
            const interval = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 60 * 1000; // Random between 1 and 5 minutes
            this.timeoutId = setTimeout(async () => {
                const screenshots = await this.takeSnapshotAllScreens();
                callback(screenshots);  // Execute the callback function to handle screenshots
                if (this.randomInterval !== null) {  // Check if we should continue
                    takeScreenshot();  // Schedule the next screenshot
                }
            }, interval);
        };
        this.randomInterval = true;  // Set this to true to indicate we're capturing
        takeScreenshot();  // Start the first screenshot
    }

    // Stop the random screenshot capturing
    stopRandomScreenshotInterval() {
        this.randomInterval = null;  // Set this to null to stop future captures
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);  // Clear any pending timeout
            this.timeoutId = null;
        }
    }

    // Optional: If we want to save the screenshots to a database in the future
    async saveScreenshotsToDatabase(screenshots) {
        // Placeholder: Implement your logic to save screenshots (bitmaps) to a database or external storage
        // This could involve converting the bitmaps to blobs and then uploading them to a server.
        console.log('Saving screenshots to database...');
    }


    ///// FOR VIDEO CAPTURE /////
    // Set the codec
    setCodec(codecId) {
        const codec = this.codecs.find(c => c.id === codecId);
        if (codec) {
            this.selectedCodec = codec;
        } else {
            throw new Error(`Codec ${codecId} not supported`);
        }
    }

    // Set video quality (low, medium, high)
    setVideoQuality(quality) {
        const validQualities = ['low', 'medium', 'high'];
        if (validQualities.includes(quality)) {
            this.videoQuality = quality;
        } else {
            throw new Error(`Invalid video quality: ${quality}`);
        }
    }

    // Set frame rate
    setFrameRate(rate) {
        if (rate >= 1 && rate <= 60) {
            this.frameRate = rate;
        } else {
            throw new Error('Frame rate should be between 1 and 60');
        }
    }

    // Start capturing the screen
    async startCapture() {
        const constraints = {
            video: { cursor: "always", frameRate: this.frameRate },
            audio: true
        };

        // Set resolution based on video quality
        switch (this.videoQuality) {
            case 'low':
                constraints.video.width = { ideal: 640 };
                constraints.video.height = { ideal: 480 };
                break;
            case 'medium':
                constraints.video.width = { ideal: 1280 };
                constraints.video.height = { ideal: 720 };
                break;
            case 'high':
                constraints.video.width = { ideal: 1920 };
                constraints.video.height = { ideal: 1080 };
                break;
            default:
                break;
        }

        this.stream = await navigator.mediaDevices.getDisplayMedia(constraints);

        let options = {};
        if (this.selectedCodec && MediaRecorder.isTypeSupported(this.selectedCodec.mimeType)) {
            options = {
                mimeType: this.selectedCodec.mimeType,
                videoBitsPerSecond: this.getBitrate(this.videoQuality)
            };
        } else {
            options = { mimeType: 'video/webm' }; // Default codec
        }

        this.mediaRecorder = new MediaRecorder(this.stream, options);

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.start();
    }

    // Stop capturing
    stopCapture() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.stream.getTracks().forEach(track => track.stop());
        }
    }

    // Get the recorded video as Blob
    getCapturedBlob() {
        return new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'video/webm' });
    }

    // Download the captured video
    downloadCapturedVideo(filename = 'screen_capture') {
        const blob = this.getCapturedBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${filename}.${this.selectedCodec ? this.selectedCodec.extension : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
    }

    // Helper method to get bitrate based on quality
    getBitrate(quality) {
        switch (quality) {
            case 'low': return 1000000; // 1 Mbps
            case 'medium': return 2500000; // 2.5 Mbps
            case 'high': return 5000000; // 5 Mbps
            default: return 2500000;
        }
    }
}
