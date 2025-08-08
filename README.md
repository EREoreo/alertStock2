# 📊 AlertStock - Real-time Stock Price Monitor

A modern, real-time stock price monitoring application with intelligent price alerts and sound notifications.

![AlertStock Screenshot](https://via.placeholder.com/800x400/1f2937/ffffff?text=AlertStock+Dashboard)

## ✨ Features

### 🔍 **Smart Stock Search**
- Search from 9,000+ NASDAQ & NYSE stocks
- Real-time ticker lookup with autocomplete
- Easy one-click addition to watchlist

### 📈 **Live Price Monitoring**
- Real-time price updates (1s, 5s, 10s, 30s, 1m, 5m intervals)
- Visual price change indicators (green/red)
- Automatic data persistence with localStorage

### 🚨 **Intelligent Price Alerts**
- **Range-based alerts** instead of simple above/below
- Three status indicators:
  - 🔴 **Below Range** - Price under minimum
  - 🟢 **In Range** - Price within target range
  - 🔵 **Above Range** - Price over maximum

### 🔊 **Sound Notifications**
- Triple sound alerts (3x repetition)
- Different sounds for enter/exit events
- Adjustable volume control
- Browser notifications with permissions

### 💾 **Data Persistence**
- All data saved in localStorage
- Survives browser refreshes and restarts
- Settings and preferences remembered

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- FinViz Elite API access (for real-time data)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/EREoreo/alertStock.git
cd alertStock
```

2. **Install frontend dependencies:**
```bash
npm install
```

3. **Install backend dependencies:**
```bash
cd backend
npm install express cors
```

4. **Add your CSV ticker files:**
   - Place `all nasdaq.csv` in project root
   - Place `all nyse.csv` in project root

5. **Configure API credentials:**
   - Update `config.auth` in `api-server.js` with your FinViz Elite token

6. **Start the backend server:**
```bash
node api-server.js
```

7. **Start the frontend (in new terminal):**
```bash
npm run dev
```

8. **Open your browser:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001`

## 🏗️ Architecture

### Frontend (React + Vite)
- **React 18** with Hooks
- **Tailwind CSS 3.4.17** for styling
- **Lucide React** for icons
- **Real-time updates** with intervals
- **localStorage** for persistence

### Backend (Node.js + Express)
- **Express.js** REST API
- **FinViz Elite** integration
- **CSV parsing** for ticker lookup
- **CORS enabled** for frontend communication

## 📡 API Endpoints

### Stock Data
- `GET /api/health` - Health check
- `GET /api/stock/:symbol` - Get single stock price
- `POST /api/stocks/batch` - Get multiple stock prices
- `GET /api/search/:query` - Search tickers
- `GET /api/tickers` - List all available tickers

### Request Examples
```bash
# Get single stock
curl http://localhost:3001/api/stock/AAPL

# Search tickers
curl http://localhost:3001/api/search/apple

# Batch request
curl -X POST http://localhost:3001/api/stocks/batch \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","MSFT","GOOGL"]}'
```

## 🎮 Usage

### Adding Stocks to Watchlist
1. Enter stock symbol in search box
2. Click search or press Enter
3. Click the "+" button next to desired stock
4. Stock appears in watchlist with live prices

### Creating Price Alerts
1. Click "Add Alert" button
2. Select stock from your watchlist
3. Set minimum and maximum price range
4. Choose alert conditions:
   - 🟢 **Alert on Enter** - notify when price enters range
   - 🔴 **Alert on Exit** - notify when price leaves range
5. Test sounds with volume slider
6. Click "Create Alert"

### Managing Updates
- **Auto ON/OFF** - Toggle automatic price updates
- **Update interval** - Choose from 1s to 5m
- **Manual Update** - Force immediate price refresh
- **Auto-pause** - Updates pause when creating alerts

## 🔧 Configuration

### Update Intervals
```javascript
const intervals = {
  '1s': 1000,    // Testing only - high API load
  '5s': 5000,    // Active trading
  '10s': 10000,  // Regular monitoring
  '30s': 30000,  // Default
  '1m': 60000,   // Conservative
  '5m': 300000   // Long-term watching
};
```

### Sound Settings
```javascript
const soundConfig = {
  volume: 0.8,        // 80% volume
  repetitions: 3,     // Play 3 times
  interval: 800,      // 800ms between sounds
  duration: 600       // 600ms per sound
};
```

## 📊 Data Storage

All data is stored in browser's localStorage:

```javascript
localStorage.setItem('watchlist', JSON.stringify([...]));
localStorage.setItem('alerts', JSON.stringify([...]));
localStorage.setItem('updateInterval', 30);
localStorage.setItem('isAutoUpdate', true);
```

## 🎨 UI/UX Features

### Responsive Design
- **Desktop**: 3-column layout (Search | Watchlist | Alerts)
- **Mobile**: Stacked single-column layout
- **Dark theme** optimized for extended use

### Visual Indicators
- 🟢 **Green** - Price increases, in-range alerts
- 🔴 **Red** - Price decreases, below-range alerts  
- 🔵 **Blue** - Above-range alerts
- ⚡ **Loading spinners** for all async operations
- 📊 **Real-time counters** for positive/negative stocks

## 🔐 Security Notes

- **API keys** should be environment variables in production
- **Rate limiting** recommended for public APIs
- **Input validation** implemented for all user inputs
- **XSS protection** through React's built-in escaping

## 🚫 Limitations

- **FinViz API** required for real-time data
- **Browser storage** limited to ~5-10MB
- **CORS** must be configured for production deployment
- **Sound notifications** require user interaction (browser policy)

## 🛠️ Development

### Project Structure
```
alertStock/
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind imports
├── api-server.js        # Backend API server
├── all nasdaq.csv       # NASDAQ ticker list
├── all nyse.csv         # NYSE ticker list
├── package.json         # Frontend dependencies
└── README.md           # This file
```

### Adding Features
1. **New API endpoints** - Add to `api-server.js`
2. **UI components** - Add to `App.jsx`
3. **Sound effects** - Modify `playAlertSound()` function
4. **Data persistence** - Update localStorage functions

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **FinViz** for providing financial data API
- **Tailwind CSS** for the styling framework
- **Lucide** for the beautiful icons
- **React** team for the amazing framework

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/EREoreo/alertStock/issues) page
2. Create a new issue with detailed description
3. Include browser console errors if applicable

---

**Made with ❤️ for traders and investors who need real-time price alerts**