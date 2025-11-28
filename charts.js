class ChartManager {
    constructor() {
        this.charts = {};
        this.dataHistory = {
            production: [],
            stackParams: [],
            mpcPerformance: []
        };
        this.maxHistoryLength = 100;
        
        this.init();
    }

    init() {
        this.createProductionChart();
        this.createStackParamsChart();
        this.createMPCComparisonChart();
        
        // Start data simulation if no real data
        this.startDataSimulation();
    }

    createProductionChart() {
        const ctx = document.getElementById('production-chart').getContext('2d');
        
        this.charts.production = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'H₂ Production (L/h)',
                        data: [],
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'O₂ Production (L/h)',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Real-time Production Rates'
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Production Rate (L/h)'
                        },
                        beginAtZero: true
                    }
                },
                animation: {
                    duration: 0
                }
            }
        });
    }

    createStackParamsChart() {
        const ctx = document.getElementById('stack-params-chart').getContext('2d');
        
        this.charts.stackParams = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Stack Current (A)',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y',
                        tension: 0.4
                    },
                    {
                        label: 'Stack Temperature (°C)',
                        data: [],
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243, 156, 18, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y1',
                        tension: 0.4
                    },
                    {
                        label: 'Stack Voltage (V)',
                        data: [],
                        borderColor: '#9b59b6',
                        backgroundColor: 'rgba(155, 89, 182, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Stack Parameters'
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Current (A) / Voltage (V)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                },
                animation: {
                    duration: 0
                }
            }
        });
    }

    createMPCComparisonChart() {
        // This will be used in the MPC comparison panel
        const container = document.querySelector('.mpc-performance-chart');
        if (!container) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'mpc-performance-chart';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        
        this.charts.mpcPerformance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['HE-MPC', 'Deterministic', 'Stochastic', 'Hybrid'],
                datasets: [
                    {
                        label: 'Performance Score',
                        data: [0, 0, 0, 0],
                        backgroundColor: [
                            'rgba(39, 174, 96, 0.8)',
                            'rgba(52, 152, 219, 0.8)',
                            'rgba(243, 156, 18, 0.8)',
                            'rgba(155, 89, 182, 0.8)'
                        ],
                        borderColor: [
                            '#27ae60',
                            '#3498db',
                            '#f39c12',
                            '#9b59b6'
                        ],
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'MPC Strategy Performance Comparison'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Performance Score'
                        }
                    }
                }
            }
        });
    }

    updateWithMatlabData(data) {
        const timestamp = new Date().toLocaleTimeString();
        
        // Update production chart
        if (data.h2ProductionRate !== undefined && data.o2ProductionRate !== undefined) {
            this.updateChartData('production', timestamp, [
                data.h2ProductionRate * 3600, // Convert to L/h
                data.o2ProductionRate * 3600
            ]);
        }

        // Update stack parameters chart
        if (data.stackCurrent !== undefined && data.cellTemperature !== undefined && data.stackVoltage !== undefined) {
            this.updateChartData('stackParams', timestamp, [
                data.stackCurrent,
                data.cellTemperature,
                data.stackVoltage
            ]);
        }
    }

    updateWithArduinoData(data) {
        // Additional data from Arduino can be added here
        if (data.appliedCurrent !== undefined) {
            // You might want to track applied current separately
        }
    }

    updateChartData(chartName, label, data) {
        const chart = this.charts[chartName];
        if (!chart) return;

        // Add new data point
        chart.data.labels.push(label);
        data.forEach((value, index) => {
            chart.data.datasets[index].data.push(value);
        });

        // Limit data history
        if (chart.data.labels.length > this.maxHistoryLength) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }

        // Update chart
        chart.update('none');
    }

    updateMPCComparison(comparisonData) {
        const chart = this.charts.mpcPerformance;
        if (!chart || !comparisonData) return;

        // Update performance scores
        if (comparisonData.performance) {
            const scores = [
                comparisonData.performance.hempc || 0,
                comparisonData.performance.deterministic || 0,
                comparisonData.performance.stochastic || 0,
                comparisonData.performance.hybrid || 0
            ];

            chart.data.datasets[0].data = scores;
            chart.update();
        }
    }

    startDataSimulation() {
        // Simulate data for demonstration when no real data is available
        this.simulationInterval = setInterval(() => {
            if (this.charts.production.data.labels.length === 0) {
                const now = new Date();
                const timestamp = now.toLocaleTimeString();
                
                // Simulate production data
                const h2Production = 25 + Math.random() * 10;
                const o2Production = 12 + Math.random() * 5;
                
                this.updateChartData('production', timestamp, [h2Production, o2Production]);
                
                // Simulate stack parameters
                const stackCurrent = 140 + Math.random() * 30;
                const stackTemperature = 65 + Math.random() * 10;
                const stackVoltage = 38 + Math.random() * 4;
                
                this.updateChartData('stackParams', timestamp, [
                    stackCurrent,
                    stackTemperature,
                    stackVoltage
                ]);
            }
        }, 2000);
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
    }

    // Utility methods
    exportChartData() {
        const data = {
            production: this.charts.production.data,
            stackParams: this.charts.stackParams.data,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pem-chart-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    resetCharts() {
        Object.values(this.charts).forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chart.update();
        });
    }

    // Cleanup
    destroy() {
        this.stopSimulation();
        Object.values(this.charts).forEach(chart => {
            chart.destroy();
        });
    }
}

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.charts = new ChartManager();
});
