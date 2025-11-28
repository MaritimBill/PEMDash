class MPCDashboard {
    constructor() {
        this.currentMode = 'HEMPC';
        this.mpcParameters = {
            horizon: 10,
            sampleTime: 0.1,
            qWeight: 10.0,
            rWeight: 1.0
        };
        this.performanceMetrics = {};
        this.controlHistory = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDefaultParameters();
        this.initializePerformanceTracking();
    }

    setupEventListeners() {
        // Mode selection
        document.querySelectorAll('.mode-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });

        // Parameter inputs
        document.getElementById('apply-params')?.addEventListener('click', () => {
            this.applyParameters();
        });

        // System control
        document.getElementById('start-system')?.addEventListener('click', () => {
            this.startSystem();
        });

        document.getElementById('stop-system')?.addEventListener('click', () => {
            this.stopSystem();
        });

        document.getElementById('emergency-stop')?.addEventListener('click', () => {
            this.emergencyStop();
        });

        // Real-time data updates from MQTT
        if (window.mqttClient) {
            // We'll handle updates through the MQTT client callbacks
        }
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        // Send mode change command
        if (window.mqttClient) {
            window.mqttClient.sendControlCommand({
                destination: 'arduino',
                type: 'mode_change',
                mode: mode
            });
        }

        this.logControlAction(`Switched to ${mode} mode`);
    }

    applyParameters() {
        // Get current parameter values
        this.mpcParameters = {
            horizon: parseInt(document.getElementById('horizon-length').value) || 10,
            sampleTime: parseFloat(document.getElementById('sample-time').value) || 0.1,
            qWeight: parseFloat(document.getElementById('q-weight').value) || 10.0,
            rWeight: parseFloat(document.getElementById('r-weight').value) || 1.0
        };

        // Send to MATLAB for MPC configuration
        if (window.mqttClient) {
            window.mqttClient.sendMPCConfig(this.mpcParameters);
        }

        this.logControlAction('Applied MPC parameters', this.mpcParameters);
    }

    startSystem() {
        if (window.mqttClient) {
            window.mqttClient.sendControlCommand({
                destination: 'arduino',
                type: 'system_command',
                command: 'START'
            });
        }
        this.logControlAction('System start commanded');
    }

    stopSystem() {
        if (window.mqttClient) {
            window.mqttClient.sendControlCommand({
                destination: 'arduino',
                type: 'system_command',
                command: 'STOP'
            });
        }
        this.logControlAction('System stop commanded');
    }

    emergencyStop() {
        if (window.mqttClient) {
            window.mqttClient.sendControlCommand({
                destination: 'arduino',
                type: 'system_command',
                command: 'EMERGENCY_STOP'
            });
        }
        this.logControlAction('EMERGENCY STOP activated');
    }

    updateWithArduinoData(data) {
        // Update display with Arduino data
        this.updateSystemStatus(data);
        this.updateControlParameters(data);
        this.trackPerformance(data);
    }

    updateSystemStatus(data) {
        // Update system state indicators
        const stateElement = document.querySelector('.system-state');
        if (stateElement && data.state !== undefined) {
            const states = ['WAITING', 'STARTING', 'RUNNING', 'STOPPING', 'STOPPED'];
            stateElement.textContent = states[data.state] || 'UNKNOWN';
        }

        // Update mode indicator
        if (data.mode) {
            this.currentMode = data.mode;
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === data.mode);
            });
        }

        // Update safety indicators
        this.updateSafetyIndicators(data);
    }

    updateSafetyIndicators(data) {
        const indicators = {
            temperature: {
                value: data.temperature,
                max: 80,
                warning: 75,
                element: 'temp-indicator'
            },
            purity: {
                value: data.o2Purity,
                min: 99.0,
                warning: 99.3,
                element: 'purity-indicator'
            },
            voltage: {
                value: data.stackVoltage,
                max: 45,
                warning: 42,
                element: 'voltage-indicator'
            }
        };

        Object.entries(indicators).forEach(([key, config]) => {
            if (config.value === undefined) return;

            const element = document.getElementById(config.element);
            if (!element) return;

            let percentage, status;
            
            if (config.min !== undefined) {
                // For purity (higher is better)
                percentage = ((config.value - config.min) / (100 - config.min)) * 100;
                status = config.value >= config.warning ? 'good' : 'warning';
            } else {
                // For temperature and voltage (lower is better)
                percentage = (config.value / config.max) * 100;
                status = config.value <= config.warning ? 'good' : 'warning';
            }

            element.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            element.style.background = status === 'good' ? 'var(--success-color)' : 'var(--warning-color)';

            // Critical condition
            if ((config.min && config.value < config.min) || 
                (config.max && config.value > config.max)) {
                element.style.background = 'var(--danger-color)';
            }
        });
    }

    updateControlParameters(data) {
        // Update slider positions
        if (data.prodRateSet !== undefined) {
            const slider = document.getElementById('production-slider');
            const valueDisplay = document.getElementById('slider-value');
            if (slider) slider.value = data.prodRateSet;
            if (valueDisplay) valueDisplay.textContent = `${data.prodRateSet}%`;
        }

        if (data.appliedCurrent !== undefined) {
            const slider = document.getElementById('current-slider');
            const valueDisplay = document.getElementById('current-value');
            if (slider) slider.value = data.appliedCurrent;
            if (valueDisplay) valueDisplay.textContent = `${data.appliedCurrent}A`;
        }
    }

    trackPerformance(data) {
        const timestamp = Date.now();
        
        // Track key performance metrics
        this.performanceMetrics = {
            ...this.performanceMetrics,
            lastUpdate: timestamp,
            productionRate: data.h2ProductionRate,
            efficiency: this.calculateEfficiency(data),
            stability: this.calculateStability(data)
        };

        // Store in history
        this.controlHistory.push({
            timestamp,
            mode: this.currentMode,
            data: { ...data },
            metrics: { ...this.performanceMetrics }
        });

        // Limit history size
        if (this.controlHistory.length > 1000) {
            this.controlHistory.shift();
        }
    }

    calculateEfficiency(data) {
        // Simple efficiency calculation based on production vs current
        if (data.h2ProductionRate && data.stackCurrent) {
            return (data.h2ProductionRate / data.stackCurrent) * 1000; // Arbitrary scaling
        }
        return 0;
    }

    calculateStability(data) {
        // Calculate system stability based on recent variations
        const recentData = this.controlHistory.slice(-10);
        if (recentData.length < 2) return 100;

        const currentVariations = recentData.map((entry, index, array) => {
            if (index === 0) return 0;
            return Math.abs(entry.data.stackCurrent - array[index - 1].data.stackCurrent);
        });

        const avgVariation = currentVariations.reduce((a, b) => a + b, 0) / currentVariations.length;
        return Math.max(0, 100 - avgVariation * 10); // Convert to stability score
    }

    initializePerformanceTracking() {
        // Set up periodic performance reporting
        setInterval(() => {
            this.reportPerformance();
        }, 5000); // Report every 5 seconds
    }

    reportPerformance() {
        if (window.mqttClient && this.performanceMetrics.lastUpdate) {
            const report = {
                type: 'performance_report',
                mode: this.currentMode,
                metrics: this.performanceMetrics,
                timestamp: new Date().toISOString()
            };

            window.mqttClient.sendControlCommand({
                destination: 'matlab',
                type: 'performance_data',
                data: report
            });
        }
    }

    logControlAction(action, data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action,
            data,
            mode: this.currentMode
        };

        console.log('🎛️ Control Action:', logEntry);

        // Could also send to server for persistent logging
        if (window.mqttClient) {
            window.mqttClient.sendControlCommand({
                destination: 'matlab',
                type: 'control_log',
                log: logEntry
            });
        }
    }

    getPerformanceReport() {
        return {
            currentMode: this.currentMode,
            parameters: this.mpcParameters,
            metrics: this.performanceMetrics,
            historyLength: this.controlHistory.length
        };
    }

    resetPerformanceTracking() {
        this.controlHistory = [];
        this.performanceMetrics = {};
        this.initializePerformanceTracking();
    }

    // Export functionality
    exportData() {
        const exportData = {
            parameters: this.mpcParameters,
            performance: this.performanceMetrics,
            history: this.controlHistory,
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mpc-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    loadDefaultParameters() {
        // Set default values in form inputs
        document.getElementById('horizon-length').value = this.mpcParameters.horizon;
        document.getElementById('sample-time').value = this.mpcParameters.sampleTime;
        document.getElementById('q-weight').value = this.mpcParameters.qWeight;
        document.getElementById('r-weight').value = this.mpcParameters.rWeight;
    }
}

// Initialize MPC Dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.mpcDashboard = new MPCDashboard();
});
