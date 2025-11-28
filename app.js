const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MQTT Configuration
const MQTT_BROKER = 'mqtt://localhost:1883';
const MQTT_TOPICS = {
  MATLAB_DATA: 'pem/matlab/data',
  MATLAB_CONTROL: 'pem/matlab/control',
  ARDUINO_DATA: 'pem/arduino/data',
  ARDUINO_CONTROL: 'pem/arduino/control',
  MPC_COMPARISON: 'pem/mpc/comparison'
};

// MQTT Client
let mqttClient = null;

// Initialize MQTT connection
function initializeMQTT() {
  mqttClient = mqtt.connect(MQTT_BROKER);

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    
    // Subscribe to topics
    Object.values(MQTT_TOPICS).forEach(topic => {
      mqttClient.subscribe(topic, (err) => {
        if (!err) {
          console.log(`📡 Subscribed to ${topic}`);
        }
      });
    });
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 MQTT Message on ${topic}:`, data);
      
      // Broadcast to all connected web clients
      io.emit('mqtt-data', { topic, data });
      
      // Handle specific topics
      switch(topic) {
        case MQTT_TOPICS.MATLAB_DATA:
          io.emit('matlab-update', data);
          break;
        case MQTT_TOPICS.ARDUINO_DATA:
          io.emit('arduino-update', data);
          break;
        case MQTT_TOPICS.MPC_COMPARISON:
          io.emit('mpc-comparison', data);
          break;
      }
    } catch (error) {
      console.error('❌ Error parsing MQTT message:', error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('❌ MQTT Error:', error);
  });
}

// Socket.io for real-time web communication
io.on('connection', (socket) => {
  console.log('🔌 Web client connected:', socket.id);

  // Handle control commands from web dashboard
  socket.on('control-command', (data) => {
    console.log('🎛️ Control command from web:', data);
    
    // Send to appropriate destination
    if (data.destination === 'matlab') {
      publishToMQTT(MQTT_TOPICS.MATLAB_CONTROL, data);
    } else if (data.destination === 'arduino') {
      publishToMQTT(MQTT_TOPICS.ARDUINO_CONTROL, data);
    }
  });

  // Handle MPC configuration
  socket.on('mpc-config', (config) => {
    console.log('⚙️ MPC configuration:', config);
    publishToMQTT(MQTT_TOPICS.MATLAB_CONTROL, {
      type: 'mpc_config',
      config: config
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Web client disconnected:', socket.id);
  });
});

// Publish to MQTT
function publishToMQTT(topic, message) {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, JSON.stringify(message));
    console.log(`📤 Published to ${topic}:`, message);
  } else {
    console.error('❌ MQTT client not connected');
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mqtt: mqttClient ? mqttClient.connected : false,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    services: {
      mqtt: mqttClient?.connected || false,
      websocket: io.engine.clientsCount,
      timestamp: new Date().toISOString()
    }
  });
});

// Initialize services
initializeMQTT();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 PEM Electrolyzer Dashboard running on port ${PORT}`);
  console.log(`📊 Access at: http://localhost:${PORT}`);
});
