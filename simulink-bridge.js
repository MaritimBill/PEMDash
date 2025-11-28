class SimulinkBridge {
    constructor() {
        this.isConnected = false;
        this.simulinkData = null;
        this.controlQueue = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.setupMQTTConnection();
        this.setupDataHandlers();
        this.startHealthMonitoring();
    }

    setupMQTTConnection() {
        // This would connect to MATLAB's MQTT broker
        // For now, we'll simulate the connection
        console.log('🔗 Initializing Simulink bridge connection...');
        
        setTimeout(() => {
            this.isConnected = true;
            console.log('✅ Simulink bridge connected (simulated)');
            
            // Start simulated data stream
            this.startSimulatedDataStream();
        }, 2000);
    }

    setupDataHandlers() {
        // Handle incoming MATLAB/Simulink data
        if (window.mqttClient) {
            window.mqttClient.socket.on('matlab-update', (data) => {
                this.handleSimulinkData(data);
            });
        }
    }

    handleSimulinkData(data) {
        this.simulinkData = {
            ...data,
            receivedAt: new Date().toISOString(),
            source: 'simulink'
        };

        // Update dashboard
        this.updateDashboardWithSimulinkData(data);
        
        // Process any queued control commands
        this.processControlQueue();
    }

    updateDashboardWithSimulinkData(data) {
        // Update specific Simulink-related displays
        if (data.simulationTime !== undefined) {
            this.updateSimulationTime(data.simulationTime);
        }

        if (data.controlSignals) {
            this.updateControlSignals(data.controlSignals);
        }

        if (data.performanceMetrics) {
            this.updatePerformanceMetrics(data.performanceMetrics);
        }
    }

    updateSimulationTime(simTime) {
        const element = document.getElementById('simulation-time');
        if (element) {
            element.textContent = `Simulation: ${simTime.toFixed(1)}s`;
        }
    }

    updateControlSignals(signals) {
        // Update MPC control signals from Simulink
        if (signals.mpcOutput) {
            this.updateMPCDisplay(signals.mpcOutput);
        }

        if (signals.safetyLimits) {
            this.updateSafetyLimits(signals.safetyLimits);
        }
    }

    updatePerformanceMetrics(metrics) {
        // Update performance metrics from Simulink
        if (window.mpcComparator && metrics.mpcComparison) {
            window.mpcComparator.updateComparison(metrics.mpcComparison);
        }
    }

    updateMPCDisplay(mpcData) {
        // Update MPC-specific displays
        const elements = {
            'mpc-horizon': mpcData.horizon,
            'mpc-cost': mpcData.cost,
            'mpc-iteration': mpcData.iteration
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value !== undefined) {
                element.textContent = value;
            }
        });
    }

    updateSafetyLimits(limits) {
        // Update safety limit displays
        const safetyDisplay = document.getElementById('safety-limits');
        if (safetyDisplay) {
            safetyDisplay.innerHTML = `
                <div>Max Temp: ${limits.maxTemperature}°C</div>
                <div>Min Purity: ${limits.minPurity}%</div>
                <div>Max Current: ${limits.maxCurrent}A</div>
            `;
        }
    }

    sendToSimulink(command) {
        if (!this.isConnected) {
            console.warn('Simulink bridge not connected, queuing command');
            this.controlQueue.push(command);
            return false;
        }

        try {
            // Send command to MATLAB/Simulink via MQTT
            if (window.mqttClient) {
                window.mqttClient.sendControlCommand({
                    destination: 'matlab',
                    type: 'simulink_control',
                    ...command
                });
            }

            console.log('📤 Sent to Simulink:', command);
            return true;

        } catch (error) {
            console.error('Failed to send command to Simulink:', error);
            this.controlQueue.push(command);
            return false;
        }
    }

    processControlQueue() {
        if (this.controlQueue.length === 0 || !this.isConnected) return;

        console.log(`Processing ${this.controlQueue.length} queued commands...`);
        
        while (this.controlQueue.length > 0) {
            const command = this.controlQueue.shift();
            this.sendToSimulink(command);
        }
    }

    startSimulatedDataStream() {
        // Simulate data from MATLAB/Simulink for demonstration
        this.simulationInterval = setInterval(() => {
            if (this.isConnected) {
                this.simulateSimulinkData();
            }
        }, 1000);
    }

    simulateSimulinkData() {
        const simulatedData = {
            simulationTime: Date.now() / 1000,
            h2ProductionRate: 0.03 + Math.random() * 0.02,
            o2ProductionRate: 0.015 + Math.random() * 0.01,
            stackCurrent: 140 + Math.random() * 30,
            stackVoltage: 38 + Math.random() * 4,
            cellTemperature: 65 + Math.random() * 10,
            o2Purity: 99.5 + Math.random() * 0.5,
            controlSignals: {
                mpcOutput: {
                    horizon: 10,
                    cost: (Math.random() * 10 + 5).toFixed(2),
                    iteration: Math.floor(Date.now() / 1000)
                },
                safetyLimits: {
                    maxTemperature: 80,
                    minPurity: 99.0,
                    maxCurrent: 200
                }
            },
            performanceMetrics: {
                mpcComparison: this.simulateMPCComparison()
            },
            timestamp: new Date().toISOString()
        };

        this.handleSimulinkData(simulatedData);
    }

    simulateMPCComparison() {
        return {
            hempc: {
                operationalCost: (Math.random() * 3 + 7).toFixed(2),
                h2Production: 0.03 + Math.random() * 0.02,
                efficiency: 65 + Math.random() * 15,
                computationTime: (Math.random() * 20 + 10).toFixed(1)
            },
            deterministic: {
                operationalCost: (Math.random() * 4 + 8).toFixed(2),
                h2Production: 0.025 + Math.random() * 0.02,
                efficiency: 60 + Math.random() * 15,
                computationTime: (Math.random() * 15 + 5).toFixed(1)
            },
            stochastic: {
                operationalCost: (Math.random() * 2 + 6).toFixed(2),
                h2Production: 0.028 + Math.random() * 0.02,
                efficiency: 70 + Math.random() * 10,
                computationTime: (Math.random() * 40 + 20).toFixed(1)
            },
            hybrid: {
                operationalCost: (Math.random() * 3 + 7.5).toFixed(2),
                h2Production: 0.032 + Math.random() * 0.02,
                efficiency: 68 + Math.random() * 12,
                computationTime: (Math.random() * 30 + 15).toFixed(1)
            }
        };
    }

    startHealthMonitoring() {
        setInterval(() => {
            this.checkConnectionHealth();
        }, 5000);
    }

    checkConnectionHealth() {
        if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect to Simulink... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.setupMQTTConnection();
        }
    }

    // MPC-specific communication methods
    sendMPCParameters(parameters) {
        return this.sendToSimulink({
            type: 'mpc_parameters',
            parameters: parameters
        });
    }

    sendMPCSetpoint(setpoint) {
        return this.sendToSimulink({
            type: 'mpc_setpoint',
            setpoint: setpoint
        });
    }

    requestMPCComparison() {
        return this.sendToSimulink({
            type: 'mpc_comparison_request'
        });
    }

    sendEmergencyStop() {
        return this.sendToSimulink({
            type: 'emergency_stop',
            timestamp: new Date().toISOString()
        });
    }

    // Data logging methods
    startDataLogging() {
        return this.sendToSimulink({
            type: 'start_logging',
            filename: `pem_data_${new Date().toISOString().split('T')[0]}.mat`
        });
    }

    stopDataLogging() {
        return this.sendToSimulink({
            type: 'stop_logging'
        });
    }

    // Simulation control methods
    startSimulation() {
        return this.sendToSimulink({
            type: 'start_simulation'
        });
    }

    pauseSimulation() {
        return this.sendToSimulink({
            type: 'pause_simulation'
        });
    }

    stopSimulation() {
        return this.sendToSimulink({
            type: 'stop_simulation'
        });
    }

    setSimulationSpeed(speed) {
        return this.sendToSimulink({
            type: 'simulation_speed',
            speed: speed
        });
    }

    // Diagnostic methods
    runDiagnostics() {
        return this.sendToSimulink({
            type: 'run_diagnostics'
        });
    }

    getSimulationStatus() {
        return this.sendToSimulink({
            type: 'status_request'
        });
    }

    // Utility methods
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            simulinkData: this.simulinkData,
            queuedCommands: this.controlQueue.length,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    clearQueue() {
        this.controlQueue = [];
        console.log('🗑️ Control queue cleared');
    }

    disconnect() {
        this.isConnected = false;
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        console.log('🔌 Simulink bridge disconnected');
    }

    reconnect() {
        this.reconnectAttempts = 0;
        this.disconnect();
        this.setupMQTTConnection();
    }
}

// Initialize Simulink bridge when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.simulinkBridge = new SimulinkBridge();
});
