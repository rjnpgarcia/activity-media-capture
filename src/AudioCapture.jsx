import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import SideNav from "./layout/SideNav";
const { ipcRenderer } = window.require("electron");

class AudioCapture extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            inputDevices: [],
            outputDevices: [],
            selectedInputDevice: "",
            selectedOutputDevice: "",
            isRecording: false,
            isPaused: false,
            deviceError: null,
            audioBlob: null,
            notification: null,
            selectedDeviceType: "input", // or 'output'
            outputRecording: null,
            sampleRate: 22050,
            channels: 2,
            frameSize: 1920
        };
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.handleAudioCaptureStarted =
            this.handleAudioCaptureStarted.bind(this);
        this.handleAudioData = this.handleAudioData.bind(this);
        // this.handleAudioCaptureError = this.handleAudioCaptureError.bind(this);
        this.handleAudioCaptureStopped =
            this.handleAudioCaptureStopped.bind(this);
    }

    componentDidMount() {
        this.requestAudioPermission();
        ipcRenderer.on("audio-capture-started", this.handleAudioCaptureStarted);
        ipcRenderer.on("audio-data", this.handleAudioData);
        // ipcRenderer.on('audio-capture-error', this.handleAudioCaptureError);
        ipcRenderer.on("audio-capture-stopped", this.handleAudioCaptureStopped);
    }

    componentWillUnmount() {
        ipcRenderer.removeListener(
            "audio-capture-started",
            this.handleAudioCaptureStarted
        );
        ipcRenderer.removeListener("audio-data", this.handleAudioData);
        // ipcRenderer.removeListener('audio-capture-error', this.handleAudioCaptureError);
        ipcRenderer.removeListener(
            "audio-capture-stopped",
            this.handleAudioCaptureStopped
        );
    }

    handleAudioCaptureStarted(event, { sampleRate, channels, frameSize }) {
        console.log("Audio capture started successfully");
        this.setState({ sampleRate, channels, frameSize });
        this.audioChunks = [];
    }

    handleAudioData = (event, data) => {
        console.log(data);
        this.audioChunks.push(data);
    };

    handleAudioCaptureStopped = () => {
        console.log("Audio capture stopped, creating MP3 blob");
        const blob = new Blob(this.audioChunks, { type: "audio/mp3" });
        this.setState({
            audioBlob: blob,
            isRecording: false
        });
        console.log("MP3 blob created:", blob);
        this.showNotification("Recording stopped and saved", "success");
    };

    showNotification = (message, type = "info") => {
        this.setState({ notification: { message, type } });
        setTimeout(() => this.setState({ notification: null }), 5000); // Clear after 5 seconds
    };

    requestAudioPermission = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            this.showNotification("Audio permission granted", "success");
            this.getAudioDevices();
        } catch (error) {
            console.error("Error requesting audio permission:", error);
            this.setState({
                deviceError: "Permission to access audio devices was denied"
            });
            this.showNotification(
                "Permission to access audio devices was denied",
                "error"
            );
        }
    };

    getAudioDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputDevices = devices.filter(
                (device) => device.kind === "audioinput"
            );
            // const outputDevices = devices.filter(device => device.kind === 'audiooutput');
            const devicesOut = await ipcRenderer.invoke("get-audio-devices");
            const outputDevices = devicesOut.filter(
                (device) => device.isOutput
            );

            this.setState({ inputDevices, outputDevices });

            if (inputDevices.length === 0) {
                this.showNotification("No input devices detected", "warning");
            }
            if (outputDevices.length === 0) {
                this.showNotification("No output devices detected", "warning");
            }
        } catch (error) {
            console.error("Error getting audio devices:", error);
            this.setState({ deviceError: "Failed to get audio devices" });
            this.showNotification("Failed to get audio devices", "error");
        }
    };

    handleInputDeviceChange = (event) => {
        this.setState({ selectedInputDevice: event.target.value });
        this.showNotification(
            `Input device changed to: ${
                event.target.options[event.target.selectedIndex].text
            }`
        );
    };

    handleOutputDeviceChange = (event) => {
        this.setState({ selectedOutputDevice: event.target.value });
        this.showNotification(
            `Output device changed to: ${
                event.target.options[event.target.selectedIndex].text
            }`
        );
    };

    handleRecord = async () => {
        const {
            selectedDeviceType,
            selectedInputDevice,
            selectedOutputDevice
        } = this.state;
        if (selectedDeviceType === "input" && !selectedInputDevice) {
            this.showNotification(
                "Please select an input device before recording",
                "warning"
            );
            return;
        }
        if (selectedDeviceType === "output" && !selectedOutputDevice) {
            this.showNotification(
                "Please select an output device before recording",
                "warning"
            );
            return;
        }

        try {
            this.audioChunks = []; // Reset audio chunks
            if (selectedDeviceType === "input") {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: selectedInputDevice } }
                });
                this.mediaRecorder = new MediaRecorder(stream);
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };
                this.mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(this.audioChunks, {
                        type: "audio/wav"
                    });
                    this.setState({ audioBlob });
                    this.showNotification(
                        "Recording stopped and saved",
                        "success"
                    );
                };
                this.mediaRecorder.start();
            } else if (selectedDeviceType === "output") {
                ipcRenderer.send("start-audio-capture", {
                    deviceId: selectedOutputDevice
                });
            }

            this.setState({ isRecording: true, isPaused: false });
            this.showNotification("Recording started", "info");
        } catch (error) {
            console.error("Error starting recording:", error);
            this.setState({ deviceError: "Failed to start recording" });
            this.showNotification(
                "Failed to start recording: " + error.message,
                "error"
            );
        }
    };

    handleStop = () => {
        const { selectedDeviceType, isRecording } = this.state;

        if (selectedDeviceType === "output") {
            if (isRecording) {
                ipcRenderer.send("stop-audio-capture");
                // The state will be updated in handleAudioCaptureStopped
            }
        } else if (selectedDeviceType === "input") {
            if (isRecording && this.mediaRecorder) {
                this.mediaRecorder.stop();
                // The state will be updated in the mediaRecorder.onstop callback
            }
        }

        // Common actions for both device types
        this.setState({ isRecording: false, isPaused: false });
        this.showNotification("Recording stopped", "info");
    };

    handlePause = () => {
        if (
            this.state.isRecording &&
            this.state.selectedDeviceType === "input"
        ) {
            if (this.state.isPaused) {
                this.mediaRecorder.resume();
                this.showNotification("Recording resumed", "info");
            } else {
                this.mediaRecorder.pause();
                this.showNotification("Recording paused", "info");
            }
            this.setState((prevState) => ({ isPaused: !prevState.isPaused }));
        } else if (this.state.selectedDeviceType === "output") {
            this.showNotification(
                "Pause is not supported for output device recording",
                "warning"
            );
        }
    };
    handleSave = () => {
        if (this.state.audioBlob) {
            const url = URL.createObjectURL(this.state.audioBlob);
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            a.href = url;
            a.download = "recording.wav";
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification("Recording saved", "success");
        } else {
            this.showNotification("No recording to save", "warning");
        }
    };

    handleDeviceTypeChange = (event) => {
        this.setState({ selectedDeviceType: event.target.value });
    };

    render() {
        const {
            inputDevices,
            outputDevices,
            selectedInputDevice,
            selectedOutputDevice,
            selectedDeviceType,
            isRecording,
            isPaused,
            deviceError,
            audioBlob,
            notification
        } = this.state;

        return (
            <div className="d-flex">
                <SideNav
                    title="Audio Capture"
                    link1="Usage Tracker"
                    route1="/"
                    link2="Audio Capture"
                    route2="/audiocapture"
                    link3="Screen Capture"
                    route3="/screencapture"
                />

                {/* Main Content */}
                <div
                    className="container mt-5"
                    style={{ marginLeft: "250px", padding: 20 }}
                >
                    <div className="card shadow-sm p-4">
                        <h2 className="text-center mb-4">Audio Recorder</h2>
                        <div
                            className={`alert alert-${
                                notification && notification.type
                            }`}
                        >
                            {notification && notification.message}
                        </div>
                        <div className="mb-3">
                            <div className="form-check form-check-inline">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    value="input"
                                    checked={selectedDeviceType === "input"}
                                    onChange={this.handleDeviceTypeChange}
                                />
                                <label className="form-check-label">
                                    Input Device
                                </label>
                            </div>
                            <div className="form-check form-check-inline">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    value="output"
                                    checked={selectedDeviceType === "output"}
                                    onChange={this.handleDeviceTypeChange}
                                />
                                <label className="form-check-label">
                                    Output Device
                                </label>
                            </div>
                        </div>
                        {selectedDeviceType === "input" && (
                            <div className="mb-3">
                                <label className="form-label">
                                    Select Input Device:
                                </label>
                                <select
                                    className="form-select"
                                    value={selectedInputDevice}
                                    onChange={this.handleInputDeviceChange}
                                >
                                    <option value="">Select device</option>
                                    {inputDevices.map((device) => (
                                        <option
                                            key={device.deviceId}
                                            value={device.deviceId}
                                        >
                                            {device.label ||
                                                `Microphone ${device.deviceId.slice(
                                                    0,
                                                    5
                                                )}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {selectedDeviceType === "output" && (
                            <div className="mb-3">
                                <label className="form-label">
                                    Select Output Device:
                                </label>
                                <select
                                    className="form-select"
                                    value={selectedOutputDevice}
                                    onChange={this.handleOutputDeviceChange}
                                >
                                    <option value="">
                                        Select output device
                                    </option>
                                    {outputDevices.map((device) => (
                                        <option
                                            key={device.id}
                                            value={device.id}
                                        >
                                            {device.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="d-flex justify-content-center">
                            <button
                                className={`btn ${
                                    isRecording
                                        ? "btn-secondary"
                                        : "btn-primary"
                                } m-3`}
                                onClick={this.handleRecord}
                                disabled={isRecording}
                            >
                                Record
                            </button>
                            <button
                                className={`btn ${
                                    !isRecording
                                        ? "btn-secondary"
                                        : "btn-warning"
                                } m-3`}
                                onClick={this.handlePause}
                                disabled={!isRecording}
                            >
                                {isPaused ? "Resume" : "Pause"}
                            </button>
                            <button
                                className={`btn ${
                                    !isRecording
                                        ? "btn-secondary"
                                        : "btn-danger"
                                } m-3`}
                                onClick={this.handleStop}
                                disabled={!isRecording}
                            >
                                Stop
                            </button>
                            <button
                                className={`btn ${
                                    !audioBlob ? "btn-secondary" : "btn-success"
                                } m-3`}
                                onClick={this.handleSave}
                                disabled={!audioBlob}
                            >
                                Save
                            </button>
                        </div>
                        {audioBlob && (
                            <div className="mt-3">
                                <audio
                                    src={URL.createObjectURL(audioBlob)}
                                    controls
                                    className="w-100"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

export default AudioCapture;
