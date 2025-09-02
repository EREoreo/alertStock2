import { useState, useEffect } from 'react';
import { Search, Trash2, Plus, Settings, TrendingUp, TrendingDown, Bell } from 'lucide-react';

const API_BASE_URL = '/api';

const StockPriceMonitor = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState({
    column1: [],
    column2: [],
    column3: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertForm, setAlertForm] = useState({
    symbol: '',
    minPrice: '',
    maxPrice: ''
  });
  const [draggedAlert, setDraggedAlert] = useState(null);
  const [draggedFromColumn, setDraggedFromColumn] = useState(null);
  
  const playAlertSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.setValueAtTime(800, audioContext.currentTime);
          gain.gain.setValueAtTime(0.5, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.1);
        }, i * 150);
      }
    } catch (error) {
      console.error('Ошибка звука:', error);
    }
  };

  const saveToLocalStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Ошибка сохранения ${key}:`, error);
    }
  };

  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return defaultValue;
      const parsed = JSON.parse(saved);
      if (typeof parsed !== 'object' || parsed === null) return defaultValue;
      return parsed;
    } catch (error) {
      console.error(`Ошибка загрузки ${key}:`, error);
      return defaultValue;
    }
  };

  const searchTickers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search/${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getStockData = async (symbol) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stock/${symbol}`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error(`Ошибка получения ${symbol}:`, error);
      return null;
    }
  };

  const updatePrices = async () => {
    const currentWatchlist = loadFromLocalStorage('watchlist', []);
    if (!currentWatchlist || currentWatchlist.length === 0) return;

    try {
      const response = await fetch(`${API_BASE_URL}/stocks/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: currentWatchlist.map(s => s.symbol) })
      });

      const data = await response.json();
      
      if (data.success) {
        const updatedWatchlist = currentWatchlist.map(stock => {
          const newData = data.data.find(d => d.symbol === stock.symbol);
          return newData ? { ...newData } : stock;
        });
        setWatchlist(updatedWatchlist);
        saveToLocalStorage('watchlist', updatedWatchlist);

        setAlerts(prevAlerts => {
          const safeAlerts = {
            column1: Array.isArray(prevAlerts?.column1) ? prevAlerts.column1 : [],
            column2: Array.isArray(prevAlerts?.column2) ? prevAlerts.column2 : [],
            column3: Array.isArray(prevAlerts?.column3) ? prevAlerts.column3 : []
          };
          
          const updatedAlerts = { ...safeAlerts };
          let soundPlayed = false;

          Object.keys(updatedAlerts).forEach(column => {
            updatedAlerts[column] = updatedAlerts[column].map(alert => {
              const stockData = data.data.find(d => d.symbol === alert.symbol);
              if (stockData) {
                const prevStatus = alert.status;
                const newAlert = { ...alert, currentPrice: stockData.price };
                
                if (stockData.price >= alert.minPrice && stockData.price <= alert.maxPrice) {
                  newAlert.status = 'in-range';
                  newAlert.percentDiff = 0;
                  
                  if (prevStatus !== 'in-range' && prevStatus !== 'pending' && !soundPlayed) {
                    console.log(`🔔 ${alert.symbol} вошел в диапазон!`);
                    playAlertSound();
                    soundPlayed = true;
                  }
                } else if (stockData.price > alert.maxPrice) {
                  newAlert.status = 'above';
                  newAlert.percentDiff = ((stockData.price - alert.maxPrice) / alert.maxPrice * 100).toFixed(1);
                } else {
                  newAlert.status = 'below';
                  newAlert.percentDiff = ((alert.minPrice - stockData.price) / alert.minPrice * 100).toFixed(1);
                }
                
                return newAlert;
              }
              return alert;
            });
          });

          saveToLocalStorage('alerts', updatedAlerts);
          return updatedAlerts;
        });
        
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Ошибка обновления:', error);
      setIsConnected(false);
    }
  };

  const addToWatchlist = async (symbol) => {
    if (watchlist.some(s => s.symbol === symbol)) {
      alert(`${symbol} уже в watchlist`);
      return;
    }

    const stockData = await getStockData(symbol);
    if (stockData) {
      const newWatchlist = [...watchlist, stockData];
      setWatchlist(newWatchlist);
      saveToLocalStorage('watchlist', newWatchlist);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    const newWatchlist = watchlist.filter(s => s.symbol !== symbol);
    setWatchlist(newWatchlist);
    saveToLocalStorage('watchlist', newWatchlist);
    
    const newAlerts = { ...alerts };
    Object.keys(newAlerts).forEach(column => {
      newAlerts[column] = newAlerts[column].filter(a => a.symbol !== symbol);
    });
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
  };

  const createAlert = () => {
    if (!alertForm.symbol || !alertForm.minPrice || !alertForm.maxPrice) {
      alert('Заполните все поля');
      return;
    }

    const minPrice = parseFloat(alertForm.minPrice);
    const maxPrice = parseFloat(alertForm.maxPrice);

    if (minPrice >= maxPrice) {
      alert('Минимальная цена должна быть меньше максимальной');
      return;
    }

    const stock = watchlist.find(s => s.symbol === alertForm.symbol);
    if (!stock) {
      alert('Акция не найдена в watchlist');
      return;
    }

    const newAlert = {
      id: Date.now() + Math.random(),
      symbol: alertForm.symbol,
      minPrice,
      maxPrice,
      currentPrice: stock.price,
      status: 'pending',
      percentDiff: 0
    };

    if (stock.price >= minPrice && stock.price <= maxPrice) {
      newAlert.status = 'in-range';
    } else if (stock.price > maxPrice) {
      newAlert.status = 'above';
      newAlert.percentDiff = ((stock.price - maxPrice) / maxPrice * 100).toFixed(1);
    } else {
      newAlert.status = 'below';
      newAlert.percentDiff = ((minPrice - stock.price) / minPrice * 100).toFixed(1);
    }

    const newAlerts = { 
      ...alerts,
      column1: [...(alerts.column1 || []), newAlert]
    };
    
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
    setShowAlertModal(false);
    setAlertForm({ symbol: '', minPrice: '', maxPrice: '' });
  };

  const deleteAlert = (columnKey, alertId) => {
    const newAlerts = { ...alerts };
    newAlerts[columnKey] = newAlerts[columnKey].filter(a => a.id !== alertId);
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
  };

  const handleDragStart = (alert, column) => {
    setDraggedAlert(alert);
    setDraggedFromColumn(column);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetColumn) => {
    e.preventDefault();
    
    if (!draggedAlert || !draggedFromColumn) return;
    
    const newAlerts = { ...alerts };
    newAlerts[draggedFromColumn] = newAlerts[draggedFromColumn].filter(
      a => a.id !== draggedAlert.id
    );
    newAlerts[targetColumn] = [...newAlerts[targetColumn], draggedAlert];
    
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
    setDraggedAlert(null);
    setDraggedFromColumn(null);
  };

  useEffect(() => {
    const savedWatchlist = loadFromLocalStorage('watchlist', []);
    const savedAlerts = loadFromLocalStorage('alerts', {
      column1: [],
      column2: [],
      column3: []
    });
    
    const alertsToSet = {
      column1: Array.isArray(savedAlerts?.column1) ? savedAlerts.column1 : [],
      column2: Array.isArray(savedAlerts?.column2) ? savedAlerts.column2 : [],
      column3: Array.isArray(savedAlerts?.column3) ? savedAlerts.column3 : []
    };
    
    setWatchlist(savedWatchlist);
    setAlerts(alertsToSet);
  }, []);

  useEffect(() => {
    const firstUpdate = setTimeout(() => {
      updatePrices();
    }, 1000);
    
    const interval = setInterval(() => {
      updatePrices();
    }, 4000);
    
    return () => {
      clearTimeout(firstUpdate);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery) searchTickers(searchQuery);
    }, 500);
    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const AlertCard = ({ alert, column }) => {
    const [showDelete, setShowDelete] = useState(false);
    
    const getAlertStyle = () => {
      if (alert.status === 'in-range') {
        return 'bg-green-500 text-white';
      } else if (alert.status === 'above') {
        return 'bg-blue-500 text-white';
      } else if (alert.status === 'below') {
        return 'bg-red-500 text-white';
      }
      return 'bg-gray-600 text-white';
    };

    const getStatusText = () => {
      if (alert.status === 'in-range') {
        return 'IN RANGE';
      } else if (alert.status === 'above') {
        return `+${alert.percentDiff}%`;
      } else if (alert.status === 'below') {
        return `-${alert.percentDiff}%`;
      }
      return 'PENDING';
    };

    return (
      <div
        draggable
        onDragStart={() => handleDragStart(alert, column)}
        onMouseEnter={() => setShowDelete(true)}
        onMouseLeave={() => setShowDelete(false)}
        className={`relative px-4 py-3 rounded-full cursor-move transition-all ${getAlertStyle()}`}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">{alert.symbol}</span>
          <span className="ml-3 text-sm font-bold">{getStatusText()}</span>
        </div>
        
        {showDelete && (
          <button
            onClick={() => deleteAlert(column, alert.id)}
            className="absolute -right-2 -top-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex w-screen">
      <div className="w-1/4 bg-gray-800 border-r border-gray-700 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-3">Add New Stock</h2>
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search stocks by symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                  {searchResults.map(symbol => (
                    <div
                      key={symbol}
                      onClick={() => addToWatchlist(symbol)}
                      className="px-3 py-2 hover:bg-gray-600 cursor-pointer"
                    >
                      {symbol}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => searchTickers(searchQuery)}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-3">Watchlist</h3>
          <div className="space-y-2">
            {watchlist.map(stock => (
              <div key={stock.symbol} className="bg-gray-700 rounded-lg p-3 group relative">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{stock.symbol}</div>
                    <div className="text-2xl font-bold">${stock.price?.toFixed(2) || 'N/A'}</div>
                    <div className={`text-sm flex items-center ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2) || '0.00'}%
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromWatchlist(stock.symbol)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                  </button>
                </div>
              </div>
            ))}
            
            {watchlist.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                No stocks in watchlist
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Bell className="w-6 h-6 text-yellow-500" />
            <span>Stock Price Monitor</span>
            <span className={`ml-3 text-sm px-2 py-1 rounded ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
              {isConnected ? 'Online' : 'Offline'}
            </span>
          </h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAlertModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Alert</span>
            </button>
            <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {['column1', 'column2', 'column3'].map((column, index) => (
            <div
              key={column}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column)}
              className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700 hover:border-gray-600 transition-colors"
            >
              <h3 className="text-sm text-gray-400 mb-4">Section {index + 1}</h3>
              <div className="space-y-3">
                {Array.isArray(alerts[column]) && alerts[column].map(alert => (
                  <AlertCard key={alert.id} alert={alert} column={column} />
                ))}
              </div>
              
              {(!alerts[column] || alerts[column].length === 0) && (
                <div className="text-center text-gray-500 text-sm py-8">
                  Drop alerts here
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Add Price Alert</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Stock</label>
                <select
                  value={alertForm.symbol}
                  onChange={(e) => setAlertForm({...alertForm, symbol: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose stock...</option>
                  {watchlist.map(stock => (
                    <option key={stock.symbol} value={stock.symbol}>
                      {stock.symbol} - ${stock.price?.toFixed(2) || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Min Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={alertForm.minPrice}
                    onChange={(e) => setAlertForm({...alertForm, minPrice: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Max Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={alertForm.maxPrice}
                    onChange={(e) => setAlertForm({...alertForm, maxPrice: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAlertModal(false);
                    setAlertForm({ symbol: '', minPrice: '', maxPrice: '' });
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createAlert}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPriceMonitor;