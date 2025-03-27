import React from "react";
import SideNav from "./layout/SideNav";
import {
    Container,
    Row,
    Col,
    Card,
    Form,
    Button,
    Alert
} from "react-bootstrap";
const { ipcRenderer } = window.require("electron");
const fs = window.require("fs");

class ScreenCapture extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isRecording: false,
            recordedChunks: [],
            videoBlob: null,
            selectedCodec: "",
            codecs: [
                {
                    id: "vp8",
                    name: "VP8",
                    mimeType: "video/webm;codecs=vp8",
                    extension: "webm"
                },
                {
                    id: "vp9",
                    name: "VP9",
                    mimeType: "video/webm;codecs=vp9",
                    extension: "webm"
                },
                {
                    id: "av1",
                    name: "AV1",
                    mimeType: "video/webm;codecs=av1",
                    extension: "webm"
                },
                {
                    id: "h264",
                    name: "H.264 (AVC)",
                    mimeType: "video/mp4;codecs=h264",
                    extension: "mp4"
                },
                {
                    id: "h265",
                    name: "H.265 (HEVC)",
                    mimeType: "video/mp4;codecs=hevc",
                    extension: "mp4"
                },
                {
                    id: "mpeg4",
                    name: "MPEG-4 Part 2",
                    mimeType: "video/mp4;codecs=mp4v",
                    extension: "mp4"
                },
                {
                    id: "mjpeg",
                    name: "Motion JPEG",
                    mimeType: "video/webm;codecs=mjpeg",
                    extension: "webm"
                },
                {
                    id: "wmv",
                    name: "Windows Media Video",
                    mimeType: "video/x-ms-wmv",
                    extension: "wmv"
                },
                {
                    id: "theora",
                    name: "Theora",
                    mimeType: "video/ogg;codecs=theora",
                    extension: "ogv"
                }
            ],
            error: null,
            videoDetails: null,
            usedCodec: null,
            videoQuality: "high",
            frameRate: 30,
            fileName: "screen_capture",
            isSaving: false,
            saveMessage: "",
            snapshotBlob: null,
            snapshotFileName: "snapshot"
        };
        this.mediaRecorder = null;
    }

    componentDidMount() {
        this.checkSupportedCodecs();
    }

    checkSupportedCodecs = () => {
        const updatedCodecs = this.state.codecs.map((codec) => ({
            ...codec,
            isSupported: MediaRecorder.isTypeSupported(codec.mimeType)
        }));
        this.setState({ codecs: updatedCodecs });
    };

    handleFileNameChange = (event) => {
        this.setState({ fileName: event.target.value });
    };

    handleCodecChange = (event) => {
        this.setState({ selectedCodec: event.target.value });
    };

    handleQualityChange = (event) => {
        this.setState({ videoQuality: event.target.value });
    };

    handleFrameRateChange = (event) => {
        this.setState({ frameRate: parseInt(event.target.value, 10) });
    };

    getBitrate(quality) {
        switch (quality) {
            case "low":
                return 1000000; // 1 Mbps
            case "medium":
                return 2500000; // 2.5 Mbps
            case "high":
                return 5000000; // 5 Mbps
            default:
                return 2500000;
        }
    }

    startCapture = async () => {
        try {
            console.log("Starting screen capture");
            const sources = await ipcRenderer.invoke("get-sources");
            console.log("Sources:", sources);
            const selectedSource = await this.selectSource(sources);
            if (!selectedSource) return;

            const constraints = {
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: selectedSource.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(
                constraints
            );

            const selectedCodec = this.state.codecs.find(
                (c) => c.id === this.state.selectedCodec
            );
            let options = {
                videoBitsPerSecond: this.getBitrate(this.state.videoQuality),
                frameRate: this.state.frameRate
            };
            let usedCodec = selectedCodec;

            if (
                selectedCodec &&
                MediaRecorder.isTypeSupported(selectedCodec.mimeType)
            ) {
                options.mimeType = selectedCodec.mimeType;
            } else {
                console.warn(
                    `${
                        selectedCodec ? selectedCodec.name : "Selected codec"
                    } is not supported. Falling back to default codec.`
                );
                this.setState({
                    error: `${
                        selectedCodec ? selectedCodec.name : "Selected codec"
                    } is not supported. Using default codec.`
                });
                usedCodec = null;
            }

            this.mediaRecorder = new MediaRecorder(stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.setState((prevState) => ({
                        recordedChunks: [
                            ...prevState.recordedChunks,
                            event.data
                        ]
                    }));
                }
            };

            this.mediaRecorder.onstop = () => {
                this.setState((prevState) => {
                    const videoBlob = new Blob(prevState.recordedChunks, {
                        type: usedCodec ? usedCodec.mimeType : "video/webm"
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
            this.setState({
                error: "Error starting screen capture: " + err.message
            });
        }
    };

    getVideoDetails = (blob, usedCodec) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            const details = {
                size: (blob.size / (1024 * 1024)).toFixed(2) + " MB",
                type: blob.type,
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                duration: video.duration.toFixed(2) + " seconds"
            };
            this.setState({ videoDetails: details, usedCodec });
        };
        video.src = URL.createObjectURL(blob);
    };

    selectSource = (sources) => {
        return new Promise((resolve) => {
            ipcRenderer
                .invoke("show-source-selection", sources)
                .then((selectedSource) => {
                    resolve(selectedSource);
                });
        });
    };

    stopCapture = () => {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream
                    .getTracks()
                    .forEach((track) => track.stop());
            }
        }
    };

    downloadVideo = async () => {
        if (this.state.videoBlob) {
            this.setState({
                isSaving: true,
                saveMessage: "Preparing file for download..."
            });

            const extension = this.state.usedCodec
                ? this.state.usedCodec.extension
                : "webm";
            const fullFileName = `${this.state.fileName}.${extension}`;

            try {
                const filePath = await ipcRenderer.invoke(
                    "save-file-dialog",
                    fullFileName
                );

                if (filePath) {
                    const buffer = await this.state.videoBlob.arrayBuffer();
                    await ipcRenderer.invoke("save-file", filePath, buffer);
                    this.setState({
                        saveMessage: "File saved successfully!",
                        isSaving: false
                    });
                } else {
                    this.setState({
                        saveMessage: "File save cancelled.",
                        isSaving: false
                    });
                }
            } catch (err) {
                console.error("Error saving file:", err);
                this.setState({
                    saveMessage: "Error saving file. Please try again.",
                    isSaving: false
                });
            }
        }
    };

    takeSnapshot = async () => {
        try {
            const sources = await ipcRenderer.invoke("get-sources");

            const selectedSource = await this.selectSource(sources);
            if (!selectedSource) return;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
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

            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d");
            context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

            canvas.toBlob((blob) => {
                this.setState({ snapshotBlob: blob });
            }, "image/png");

            track.stop();
        } catch (error) {
            this.setState({ error: "Error taking snapshot: " + error.message });
        }
    };

    downloadSnapshot = async () => {
        if (this.state.snapshotBlob) {
            const filePath = await ipcRenderer.invoke(
                "save-file-dialog",
                `${this.state.snapshotFileName}.png`
            );

            if (filePath) {
                const buffer = await this.state.snapshotBlob.arrayBuffer();
                try {
                    await ipcRenderer.invoke("save-file", filePath, buffer);
                    this.setState({
                        saveMessage: "Snapshot saved successfully!"
                    });
                } catch (err) {
                    this.setState({
                        saveMessage: "Error saving snapshot. Please try again."
                    });
                }
            } else {
                this.setState({ saveMessage: "Snapshot save cancelled." });
            }
        }
    };

    handleSnapshotFileNameChange = (event) => {
        this.setState({ snapshotFileName: event.target.value });
    };
    render() {
        const {
            isRecording,
            selectedCodec,
            codecs,
            error,
            videoDetails,
            usedCodec,
            videoBlob,
            videoQuality,
            frameRate,
            fileName,
            isSaving,
            saveMessage,
            snapshotBlob,
            snapshotFileName
        } = this.state;
        return (
            <div className="d-flex">
                <SideNav
                    title="Screen Capture"
                    link1="Usage Tracker"
                    route1="/"
                    link2="Audio Capture"
                    route2="/audiocapture"
                    link3="Screen Capture"
                    route3="/screencapture"
                />

                <Container
                    fluid
                    className="p-4"
                    style={{ marginLeft: "250px", padding: 20 }}
                >
                    <h2 className="mb-4">Screen Capture</h2>

                    {/* Error Message */}
                    {error && <Alert variant="danger">{error}</Alert>}

                    {/* Codec Selection */}
                    <Card className="mb-3">
                        <Card.Body>
                            <Card.Title>Compression Codec</Card.Title>
                            <Form.Group>
                                <Form.Label>Select a codec:</Form.Label>
                                <Form.Control
                                    as="select"
                                    value={selectedCodec}
                                    onChange={this.handleCodecChange}
                                >
                                    <option value="">Select a codec</option>
                                    {codecs.map((codec) => (
                                        <option
                                            key={codec.id}
                                            value={codec.id}
                                            disabled={!codec.isSupported}
                                        >
                                            {codec.name}{" "}
                                            {codec.isSupported
                                                ? ""
                                                : "(Not supported)"}
                                        </option>
                                    ))}
                                </Form.Control>
                            </Form.Group>
                        </Card.Body>
                    </Card>

                    {/* Compression Settings */}
                    <Card className="mb-3">
                        <Card.Body>
                            <Card.Title>Compression Settings</Card.Title>
                            <Row>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label>Video Quality</Form.Label>
                                        <Form.Control
                                            as="select"
                                            value={videoQuality}
                                            onChange={this.handleQualityChange}
                                        >
                                            <option value="low">
                                                Low (640x480)
                                            </option>
                                            <option value="medium">
                                                Medium (1280x720)
                                            </option>
                                            <option value="high">
                                                High (1920x1080)
                                            </option>
                                        </Form.Control>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label>Frame Rate</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={frameRate}
                                            onChange={
                                                this.handleFrameRateChange
                                            }
                                            min="1"
                                            max="60"
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>

                    {/* Control Buttons */}
                    <div className="d-flex gap-2">
                        <Button
                            variant="primary"
                            onClick={this.startCapture}
                            disabled={isRecording}
                        >
                            Start Capture
                        </Button>
                        <Button
                            variant="danger"
                            onClick={this.stopCapture}
                            disabled={!isRecording}
                        >
                            Stop Capture
                        </Button>
                    </div>

                    {/* Video Details */}
                    {videoDetails && videoBlob && (
                        <Card className="mt-4">
                            <Card.Body>
                                <Card.Title>Video Details</Card.Title>
                                <p>
                                    <strong>Size:</strong> {videoDetails.size}
                                </p>
                                <p>
                                    <strong>Type:</strong> {videoDetails.type}
                                </p>
                                <p>
                                    <strong>Resolution:</strong>{" "}
                                    {videoDetails.resolution}
                                </p>
                                <p>
                                    <strong>Duration:</strong>{" "}
                                    {videoDetails.duration}
                                </p>
                                <p>
                                    <strong>Used Codec:</strong>{" "}
                                    {usedCodec ? usedCodec.name : "Default"}
                                </p>
                                <p>
                                    <strong>Quality Setting:</strong>{" "}
                                    {videoQuality}
                                </p>
                                <p>
                                    <strong>Frame Rate:</strong> {frameRate} fps
                                </p>

                                <Form.Group className="mt-3">
                                    <Form.Label>File Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={fileName}
                                        onChange={this.handleFileNameChange}
                                        disabled={isSaving}
                                    />
                                </Form.Group>
                                <Button
                                    className="mt-2"
                                    variant="success"
                                    onClick={this.downloadVideo}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Saving..." : "Save Video"}
                                </Button>

                                {saveMessage && (
                                    <Alert className="mt-2" variant="success">
                                        {saveMessage}
                                    </Alert>
                                )}
                            </Card.Body>
                        </Card>
                    )}

                    {/* Snapshot Controls */}
                    <div className="mt-4">
                        <Button variant="secondary" onClick={this.takeSnapshot}>
                            Take Snapshot
                        </Button>
                    </div>

                    {/* Snapshot Details */}
                    {snapshotBlob && (
                        <Card className="mt-4">
                            <Card.Body>
                                <Card.Title>Snapshot</Card.Title>
                                <img
                                    src={URL.createObjectURL(snapshotBlob)}
                                    alt="Snapshot"
                                    className="img-fluid"
                                />
                                <Form.Group className="mt-3">
                                    <Form.Label>Snapshot File Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={snapshotFileName}
                                        onChange={
                                            this.handleSnapshotFileNameChange
                                        }
                                    />
                                </Form.Group>
                                <Button
                                    className="mt-2"
                                    variant="success"
                                    onClick={this.downloadSnapshot}
                                >
                                    Save Snapshot
                                </Button>
                            </Card.Body>
                        </Card>
                    )}
                </Container>
            </div>
        );
    }
}

export default ScreenCapture;
