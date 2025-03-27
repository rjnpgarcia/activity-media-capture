import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

const { ipcRenderer } = window.require('electron');

const Settings = ({ isAppTracking, isBrowserTracking, setIsAppTracking, setIsBrowserTracking }) => {
    const handleAppTrackingChange = (e) => {
        const newValue = e.target.checked;
        setIsAppTracking(newValue);
        if (newValue) {
            ipcRenderer.send('start-app-tracking');
        } else {
            ipcRenderer.send('stop-app-tracking');
        }
    };

    const handleBrowserTrackingChange = (e) => {
        const newValue = e.target.checked;
        setIsBrowserTracking(newValue);
        if (newValue) {
            ipcRenderer.send('start-browser-tracking');
        } else {
            ipcRenderer.send('stop-browser-tracking');
        }
    };

    return (
        <div className="settings">
            <h2>Settings</h2>
            <div className="setting-item">
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={isAppTracking}
                        onChange={handleAppTrackingChange}
                    />
                    <span className="slider"></span>
                </label>
                <span>Enable App Usage Tracking</span>
            </div>
            <div className="setting-item">
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={isBrowserTracking}
                        onChange={handleBrowserTrackingChange}
                    />
                    <span className="slider"></span>
                </label>
                <span>Enable Browser Usage Tracking</span>
            </div>
        </div>
    );
};

const Reports = ({ appData, browserData, runningApps, activeApp, activeBrowser }) => {
    const INACTIVE_COLOR = '#8884d8';
    const ACTIVE_COLOR = '#4CAF50';  // A good shade of green

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return [hours, minutes, remainingSeconds]
            .map(v => v < 10 ? "0" + v : v)
            .join(":");
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip" style={{ backgroundColor: 'white', padding: '5px', border: '1px solid #ccc' }}>
                    <p className="label">{`${label} : ${formatTime(payload[0].value)}`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="reports">
            <h2>Usage Reports</h2>

            <div className="report-section">
                <h3>App Usage</h3>
                <BarChart width={700} height={300} data={appData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatTime} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="time">
                        {appData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.name === activeApp ? ACTIVE_COLOR : INACTIVE_COLOR}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </div>

            <div className="report-section">
                <h3>Browser Usage</h3>
                <BarChart width={700} height={300} data={browserData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatTime} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="time">
                        {browserData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.name === activeBrowser ? ACTIVE_COLOR : INACTIVE_COLOR}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </div>

            <div className="report-section">
                <h3>Running Applications</h3>
                <div className="running-apps-list">
                    {runningApps.map((app, index) => (
                        <div
                            key={index}
                            className={`running-app ${app.name === activeApp ? 'active' : ''}`}
                        >
                            {app.name} (PID: {app.pid})
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [isAppTracking, setIsAppTracking] = useState(false);
    const [isBrowserTracking, setIsBrowserTracking] = useState(false);
    const [activeTab, setActiveTab] = useState('reports');
    const [appData, setAppData] = useState([]);
    const [browserData, setBrowserData] = useState([]);
    const [runningApps, setRunningApps] = useState([]);
    const [activeApp, setActiveApp] = useState('');
    const [activeBrowser, setActiveBrowser] = useState('');

    useEffect(() => {
        const fetchRunningApps = async () => {
            const apps = await ipcRenderer.invoke('get-running-apps');
            setRunningApps(apps);
        };

        fetchRunningApps();
        const interval = setInterval(fetchRunningApps, 5000); // Update every 5 seconds

        // Set up listener for app usage updates
        ipcRenderer.on('app-usage-update', (event, data) => {
            const formattedData = Object.entries(data).map(([name, time]) => ({ name, time }));
            setAppData(formattedData);
        });

        // Set up listener for browser usage updates
        ipcRenderer.on('browser-usage-update', (event, data) => {
            const formattedData = Object.entries(data).map(([name, time]) => ({ name, time }));
            setBrowserData(formattedData);
        });

        // Set up listener for active app/browser updates
        ipcRenderer.on('active-app-update', (event, app) => {
            if (app.isBrowser) {
                setActiveBrowser(app.title);
            } else {
                setActiveApp(app.name);
            }
        });

        return () => {
            clearInterval(interval);
            ipcRenderer.removeAllListeners('app-usage-update');
            ipcRenderer.removeAllListeners('browser-usage-update');
            ipcRenderer.removeAllListeners('active-app-update');
        };
    }, []);

    return (
        <div className="app-container">
            <h1>Usage Tracker</h1>
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reports')}
                >
                    Reports
                </button>
                <button
                    className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    Settings
                </button>
            </div>
            <div className="tab-content">
                {activeTab === 'reports' && (
                    <Reports
                        appData={appData}
                        browserData={browserData}
                        runningApps={runningApps}
                        activeApp={activeApp}
                        activeBrowser={activeBrowser}
                    />
                )}
                {activeTab === 'settings' && (
                    <Settings
                        isAppTracking={isAppTracking}
                        isBrowserTracking={isBrowserTracking}
                        setIsAppTracking={setIsAppTracking}
                        setIsBrowserTracking={setIsBrowserTracking}
                    />
                )}
            </div>
            <button onClick={() => window.location.href = '/audiocapture'} className="screen-capture-link">
                Go to Audio Capture
            </button>
            <button onClick={() => window.location.href = '/screencapture'} className="screen-capture-link">
                Go to Screen Capture
            </button>
        </div>
    );
};
export default App;