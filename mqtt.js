class MQTTClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;
        
        // Data storage
        this.systemData = {
            matlab: null,
            arduino: null,
            mpcComparison: null,
            historical: []
        };
        
        this.init();
    }

    init() {
        this.connect();
        this.setupEventListeners();
    }

    connect() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('✅ Connected to server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.showNotification('Connected to dashboard server', 'success');
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from server');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.handleReconnection();
            });

            this.socket.on('mqtt-data', (data) => {
                this.handleMQTTData(data);
            });

            this.socket.on('matlab-update', (data) => {
                this.handleMatlabData(data);
            });

            this.socket.on('arduino-update', (data) => {
                this.handleArduinoData(data);
            });

            this.socket.on('mpc-comparison', (data) => {
                this.handleMPCComparison(data);
            });

            this.socket.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Connection error: ' + error.message, 'error');
            });

        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.handleReconnection();
        }
    }

    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
        } else {
            this.showNotification('Failed to connect to server after multiple attempts', 'error');
        }
    }

    handleMQTTData(data) {
        const { topic, data: messageData } = data;
        
        // Store historical data (limit to 1000 points)
        if (this.systemData.historical.length > 1000) {
            this.systemData.historical.shift();
        }
        
        this.systemData.historical.push({
            timestamp: new Date(),
            topic,
            data: messageData
        });

        // Update specific handlers based on topic
        if (topic.includes('matlab')) {
            this.handleMatlabData(messageData);
        } else if (topic.includes('arduino')) {
            this.handleArduinoData(messageData);
        } else if (topic.includes('mpc/comparison')) {
            this.handleMPCComparison(messageData);
        }
    }

    handleMatlabData(data) {
        this.systemData.matlab = data;
        
        // Update MATLAB status
        this.updateMatlabStatus(true);
        
        // Update dashboard with MATLAB data
        this.updateDashboardWithMatlabData(data);
        
        // Update charts
        if (window.charts) {
            window.charts.updateWithMatlabData(data);
        }
    }

    handleArduinoData(data) {
        this.systemData.arduino = data;
        
        // Update Arduino status
        this.updateArduinoStatus(true);
        
        // Update dashboard with Arduino data
        this.updateDashboardWithArduinoData(data);
        
        // Update MPC controller if in MPC mode
        if (data.mpcControlActive && window.mpcDashboard) {
            window.mpcDashboard.updateWithArduinoData(data);
        }
    }

    handleMPCComparison(data) {
        this.systemData.mpcComparison = data;
        
        // Update MPC comparison table
        if (window.mpcComparator) {
            window.mpcComparator.updateComparison(data);
        }
        
        // Update neural MPC if available
        if (window.neuralMPC && data.performance) {
            window.neuralMPC.updatePerformance(data.performance);
        }
    }

    updateDashboardWithMatlabData(data) {
        // Update production rates
        if (data.h2ProductionRate !== undefined) {
            const h2Production = document.getElementById('h2-production');
            if (h2Production) h2Production.textContent = (data.h2ProductionRate * 3600).toFixed(1);
        }
        
        if (data.o2ProductionRate !== undefined) {
            const o2Production = document.getElementById('o2-production');
            if (o2Production) o2Production.textContent = (data.o2ProductionRate * 3600).toFixed(1);
        }

        // Update stack parameters
        if (data.stackCurrent !== undefined) {
            const stackCurrent = document.getElementById('stack-current');
            if (stackCurrent) stackCurrent.textContent = data.stackCurrent.toFixed(1);
            
            // Update progress bar (100-200A range)
            const progress = ((data.stackCurrent - 100) / 100) * 100;
            const progressBar = document.getElementById('current-progress');
            if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }

        if (data.cellTemperature !== undefined) {
            const stackTemperature = document.getElementById('stack-temperature');
            if (stackTemperature) stackTemperature.textContent = data.cellTemperature.toFixed(1);
            
            // Update temperature progress (60-80°C range)
            const tempProgress = ((data.cellTemperature - 60) / 20) * 100;
            const tempBar = document.getElementById('temp-progress');
            if (tempBar) tempBar.style.width = `${Math.min(100, Math.max(0, tempProgress))}%`;
        }

        // Update last update timestamp
        this.updateLastUpdateTime();
    }

    updateDashboardWithArduinoData(data) {
        // Update system state
        if (data.state !== undefined) {
            this.updateSystemState(data.state);
        }

        // Update mode display
        if (data.mode) {
            this.updateModeDisplay(data.mode);
        }

        // Update applied current
        if (data.appliedCurrent !== undefined) {
            const currentSlider = document.getElementById('current-slider');
            const currentValue = document.getElementById('current-value');
            
            if (currentSlider) currentSlider.value = data.appliedCurrent;
            if (currentValue) currentValue.textContent = `${data.appliedCurrent}A`;
        }

        // Update production setpoint
        if (data.prodRateSet !== undefined) {
            const productionSlider = document.getElementById('production-slider');
            const sliderValue = document.getElementById('slider-value');
            
            if (productionSlider) productionSlider.value = data.prodRateSet;
            if (sliderValue) sliderValue.textContent = `${data.prodRateSet}%`;
        }

        // Update safety parameters
        if (data.o2Purity !== undefined) {
            this.updateSafetyIndicator('purity', data.o2Purity);
        }

        if (data.temperature !== undefined) {
            this.updateSafetyIndicator('temperature', data.temperature);
        }
    }

    updateSystemState(state) {
        const stateMap = {
            0: 'WAITING',
            1: 'STARTING', 
            2: 'RUNNING',
            3: 'STOPPING',
            4: 'STOPPED'
        };
        
        const stateText = stateMap[state] || 'UNKNOWN';
        this.showNotification(`System state: ${stateText}`, 'info');
    }

    updateModeDisplay(mode) {
        // Update active mode button
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });

        // Update mode in status display
        const modeDisplay = document.querySelector('.status-value');
        if (modeDisplay) {
            modeDisplay.textContent = mode;
        }
    }

    updateSafetyIndicator(type, value) {
        const indicators = {
            purity: { element: 'purity-indicator', min: 99.0, max: 100.0 },
            temperature: { element: 'temp-indicator', min: 60, max: 80 }
        };

        const indicator = indicators[type];
        if (!indicator) return;

        const element = document.getElementById(indicator.element);
        if (element) {
            const percentage = ((value - indicator.min) / (indicator.max - indicator.min)) * 100;
            element.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            
            // Color coding
            if (percentage > 80) {
                element.style.background = 'var(--success-color)';
            } else if (percentage > 60) {
                element.style.background = 'var(--warning-color)';
            } else {
                element.style.background = 'var(--danger-color)';
            }
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('#mqtt-status .status-value');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = `status-value ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    updateMatlabStatus(connected) {
        const statusElement = document.querySelector('#matlab-status .status-value');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = `status-value ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    updateArduinoStatus(connected) {
        const statusElement = document.querySelector('#arduino-status .status-value');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = `status-value ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    updateLastUpdateTime() {
        const lastUpdate = document.getElementById('last-update');
        if (lastUpdate) {
            const now = new Date();
            lastUpdate.textContent = `Last update: ${now.toLocaleTimeString()}`;
        }
    }

    sendControlCommand(command) {
        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return false;
        }

        try {
            this.socket.emit('control-command', command);
            console.log('📤 Sent control command:', command);
            return true;
        } catch (error) {
            console.error('Failed to send control command:', error);
            this.showNotification('Failed to send command', 'error');
            return false;
        }
    }

    sendMPCConfig(config) {
        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return false;
        }

        try {
            this.socket.emit('mpc-config', config);
            console.log('📤 Sent MPC config:', config);
            this.showNotification('MPC configuration updated', 'success');
            return true;
        } catch (error) {
            console.error('Failed to send MPC config:', error);
            this.showNotification('Failed to update MPC configuration', 'error');
            return false;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add to container
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    setupEventListeners() {
        // System control buttons
        document.getElementById('start-system')?.addEventListener('click', () => {
            this.sendControlCommand({
                destination: 'arduino',
                type: 'system_command',
                command: 'START'
            });
        });

        document.getElementById('stop-system')?.addEventListener('click', () => {
            this.sendControlCommand({
                destination: 'arduino', 
                type: 'system_command',
                command: 'STOP'
            });
        });

        document.getElementById('emergency-stop')?.addEventListener('click', () => {
            this.sendControlCommand({
                destination: 'arduino',
                type: 'system_command', 
                command: 'EMERGENCY_STOP'
            });
        });

        // Production slider
        const productionSlider = document.getElementById('production-slider');
        const sliderValue = document.getElementById('slider-value');

        if (productionSlider && sliderValue) {
            productionSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                sliderValue.textContent = `${value}%`;
            });

            productionSlider.addEventListener('change', (e) => {
                this.sendControlCommand({
                    destination: 'arduino',
                    type: 'setpoint',
                    prodRate: parseInt(e.target.value)
                });
            });
        }

        // Current slider
        const currentSlider = document.getElementById('current-slider');
        const currentValue = document.getElementById('current-value');

        if (currentSlider && currentValue) {
            currentSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                currentValue.textContent = `${value}A`;
            });

            currentSlider.addEventListener('change', (e) => {
                this.sendControlCommand({
                    destination: 'arduino',
                    type: 'current_setpoint',
                    current: parseInt(e.target.value)
                });
            });
        }

        // MPC mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                
                // Update UI
                modeButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Send mode change command
                this.sendControlCommand({
                    destination: 'arduino',
                    type: 'mode_change',
                    mode: mode
                });
            });
        });

        // MPC parameters apply
        document.getElementById('apply-params')?.addEventListener('click', () => {
            this.applyMPCParameters();
        });
    }

    applyMPCParameters() {
        const horizon = document.getElementById('horizon-length').value;
        const sampleTime = document.getElementById('sample-time').value;
        const qWeight = document.getElementById('q-weight').value;
        const rWeight = document.getElementById('r-weight').value;

        const config = {
            horizon: parseInt(horizon),
            sampleTime: parseFloat(sampleTime),
            qWeight: parseFloat(qWeight),
            rWeight: parseFloat(rWeight),
            timestamp: new Date().toISOString()
        };

        this.sendMPCConfig(config);
    }

    // Data access methods
    getHistoricalData() {
        return this.systemData.historical;
    }

    getCurrentData() {
        return this.systemData;
    }

    isSystemConnected() {
        return this.isConnected && this.systemData.matlab && this.systemData.arduino;
    }

    // Cleanup
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.isConnected = false;
    }
}

// Initialize MQTT client when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.mqttClient = new MQTTClient();
});
