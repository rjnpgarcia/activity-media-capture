import React, { useState, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from "recharts";
import SideNav from "./layout/SideNav";
import { Container, Row, Col, Card, Form } from "react-bootstrap";

const { ipcRenderer } = window.require("electron");

const UsageTracker = () => {
    const [isAppTracking, setIsAppTracking] = useState(false);
    const [isBrowserTracking, setIsBrowserTracking] = useState(false);
    const [appData, setAppData] = useState([]);
    const [browserData, setBrowserData] = useState([]);

    useEffect(() => {
        ipcRenderer.on("app-usage-update", (event, data) => {
            setAppData(
                Object.entries(data).map(([name, time]) => ({ name, time }))
            );
        });

        ipcRenderer.on("browser-usage-update", (event, data) => {
            setBrowserData(
                Object.entries(data).map(([name, time]) => ({ name, time }))
            );
        });

        return () => {
            ipcRenderer.removeAllListeners("app-usage-update");
            ipcRenderer.removeAllListeners("browser-usage-update");
        };
    }, []);

    const handleTrackingChange = (type) => {
        if (type === "app") {
            setIsAppTracking(!isAppTracking);
            ipcRenderer.send(
                isAppTracking ? "stop-app-tracking" : "start-app-tracking"
            );
        } else {
            setIsBrowserTracking(!isBrowserTracking);
            ipcRenderer.send(
                isBrowserTracking
                    ? "stop-browser-tracking"
                    : "start-browser-tracking"
            );
        }
    };

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    };

    return (
        <Container fluid>
            <Row>
                <Col md={2} className="bg-light p-3">
                    <SideNav
                        title="Audio Capture"
                        link1="Usage Tracker"
                        route1="/"
                        link2="Audio Capture"
                        route2="/audiocapture"
                        link3="Screen Capture"
                        route3="/screencapture"
                    />
                </Col>
                <Col md={10} className="p-4">
                    <h1 className="mb-4">Usage Tracker</h1>
                    <Row>
                        <Col md={6}>
                            <Card className="p-3 shadow-sm">
                                <Card.Title>App Usage</Card.Title>
                                <BarChart
                                    width={500}
                                    height={300}
                                    data={appData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis tickFormatter={formatTime} />
                                    <Tooltip
                                        formatter={(value) => formatTime(value)}
                                    />
                                    <Legend />
                                    <Bar dataKey="time" fill="#8884d8" />
                                </BarChart>
                            </Card>
                        </Col>
                        <Col md={6}>
                            <Card className="p-3 shadow-sm">
                                <Card.Title>Browser Usage</Card.Title>
                                <BarChart
                                    width={500}
                                    height={300}
                                    data={browserData}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis tickFormatter={formatTime} />
                                    <Tooltip
                                        formatter={(value) => formatTime(value)}
                                    />
                                    <Legend />
                                    <Bar dataKey="time" fill="#4CAF50" />
                                </BarChart>
                            </Card>
                        </Col>
                    </Row>
                    <Row className="mt-4">
                        <Col md={6}>
                            <Form.Check
                                type="switch"
                                id="app-tracking"
                                label="Enable App Usage Tracking"
                                checked={isAppTracking}
                                onChange={() => handleTrackingChange("app")}
                            />
                        </Col>
                        <Col md={6}>
                            <Form.Check
                                type="switch"
                                id="browser-tracking"
                                label="Enable Browser Usage Tracking"
                                checked={isBrowserTracking}
                                onChange={() => handleTrackingChange("browser")}
                            />
                        </Col>
                    </Row>
                </Col>
            </Row>
        </Container>
    );
};

export default UsageTracker;
