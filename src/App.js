import React from "react";
import "./App.css";
import "./UsageTracker.css";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    BrowserRouter
} from "react-router-dom";
import AudioCapture from "./AudioCapture.jsx";
import ScreenCapture from "./ScreenCapture.jsx";
import UsageTracker from "./UsageTracker.jsx";
import ActivityTracker from "./ActivityTracker.jsx";

class App extends React.Component {
    render() {
        return (
            <BrowserRouter>
                <Routes>
                    {/* <Route path="/" element={<ActivityTracker />} /> */}
                    <Route path="/" element={<UsageTracker />} />
                    <Route path="/screencapture" element={<ScreenCapture />} />
                    <Route path="/audiocapture" element={<AudioCapture />} />
                </Routes>
            </BrowserRouter>
        );
    }
}

export default App;
