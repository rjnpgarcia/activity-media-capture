# Activity Tracker and Media Capture (Electron App)

Desktop Activity Tracker is an Electron-based application that combines usage tracking, audio capturing, and screen capturing functionalities. It provides users with insights into their desktop and browser usage, along with tools for recording audio and capturing screens.

## Features

### 1. Usage Tracker

-   Tracks active applications and browser usage
-   Displays real-time usage statistics
-   Visualizes app and browser usage with interactive charts
-   Shows a list of currently running applications

### 2. Audio Capture

-   Allows selection of audio input and output devices
-   Captures audio from both input (e.g., microphone) and output (e.g., system audio) devices
-   Supports recording, pausing, and resuming of audio capture
-   Saves recorded audio as WAV files

### 3. Screen Capture

-   Captures screenshots and screen recordings
-   Allows selection of specific windows or entire screens
-   Supports various video codecs and quality settings
-   Provides options for video quality and frame rate
-   Saves screen recordings and snapshots

## Technologies Used

-   Electron
-   React
-   Node.js
-   FFmpeg (for audio processing)
-   MediaRecorder API (for screen recording)
-   Recharts (for data visualization in Usage Tracker)

## Setup

1. Clone the repository:

    ```
    git clone https://github.com/rjnpgarcia/activity-media-capture.git
    ```

2. Navigate to the project directory:

    ```
    cd desktop-activity-tracker
    ```

3. Install dependencies:

    ```
    npm install
    ```

4. Start the application:
    ```
    npm start
    ```

## Usage

### Usage Tracker

-   Navigate to the "Reports" tab to view usage statistics
-   Use the "Settings" tab to enable/disable app and browser tracking

### Audio Capture

-   Go to the Audio Capture page
-   Select an audio input or output device
-   Use the controls to start, pause, stop, and save audio recordings

### Screen Capture

-   Go to the Screen Capture page
-   Choose capture settings (codec, quality, frame rate)
-   Select the screen or window to capture
-   Use the controls to start and stop screen recording or take snapshots
-   Save the recorded video or snapshot
