import { useState, useEffect } from 'react';
import { Search, Trash2, Plus, Settings, TrendingUp, TrendingDown, Bell } from 'lucide-react';

const API_BASE_URL = '/api';

const StockPriceMonitor = () => {
  console.log('🎬 [RENDER] Компонент рендерится');
  
  // State управление
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
  
  console.log('📊 [STATE] Текущие алерты:', alerts);
  
  // Звуковое уведомление
  const playAlertSound = () => {
    console.log('🔔 [SOUND] Воспроизводим звук алерта');
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
      console.error('❌ [SOUND] Ошибка воспроизведения звука:', error);
    }
  };

  // Сохранение и загрузка из localStorage
  const saveToLocalStorage = (key, data) => {
    try {
      console.log(`💾 [SAVE] Сохраняем ${key}:`, data);
      const serializedData = JSON.stringify(data);
      localStorage.setItem(key, serializedData);
      console.log(`✅ [SAVE] Успешно сохранено ${key}`);
    } catch (error) {
      console.error(`❌ [SAVE] Ошибка сохранения ${key}:`, error);
    }
  };

  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      console.log(`📂 [LOAD] Загружаем ${key}...`);
      const saved = localStorage.getItem(key);
      if (!saved) {
        console.log(`⚠️ [LOAD] ${key} не найден, используем default:`, defaultValue);
        return defaultValue;
      }

      let parsed = JSON.parse(saved);
      console.log(`✅ [LOAD] Загружено ${key}:`, parsed);
      
      if (typeof parsed !== 'object' || parsed === null) {
        console.warn(`⚠️ [LOAD] ${key} не объект, используем default`);
        return defaultValue;
      }

      return parsed;
    } catch (error) {
      console.error(`❌ [LOAD] Ошибка загрузки ${key}:`, error);
      return defaultValue;
    }
  };

  // API функции
  const searchTickers = async (query) => {
    console.log(`🔍 [SEARCH] Поиск тикеров: "${query}"`);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search/${encodeURIComponent(query)}`);
      const data = await response.json();
      console.log('🔍 [SEARCH] Результаты:', data);
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('❌ [SEARCH] Ошибка:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getStockData = async (symbol) => {
    console.log(`📈 [STOCK] Получаем данные для ${symbol}`);
    try {
      const response = await fetch(`${API_BASE_URL}/stock/${symbol}`);
      const data = await response.json();
      console.log(`📈 [STOCK] Данные ${symbol}:`, data);
      if (data.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error(`❌ [STOCK] Ошибка получения ${symbol}:`, error);
      return null;
    }
  };

  const updatePrices = async () => {
    console.log('🔄 [UPDATE] === НАЧАЛО ОБНОВЛЕНИЯ ЦЕН ===');
    
    // Получаем актуальный watchlist из localStorage чтобы избежать замыкания
    const currentWatchlist = loadFromLocalStorage('watchlist', []);
    console.log('🔄 [UPDATE] Watchlist из localStorage:', currentWatchlist);
    
    if (!currentWatchlist || currentWatchlist.length === 0) {
      console.log('⚠️ [UPDATE] Watchlist пуст, пропускаем обновление');
      return;
    }

    try {
      console.log('📡 [UPDATE] Отправляем запрос для:', currentWatchlist.map(s => s.symbol));
      const response = await fetch(`${API_BASE_URL}/stocks/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbols: currentWatchlist.map(s => s.symbol) 
        })
      });

      const data = await response.json();
      console.log('📡 [UPDATE] Ответ от сервера:', data);
      
      if (data.success) {
        // Обновляем watchlist
        const updatedWatchlist = currentWatchlist.map(stock => {
          const newData = data.data.find(d => d.symbol === stock.symbol);
          return newData ? { ...newData } : stock;
        });
        console.log('📈 [UPDATE] Обновленный watchlist:', updatedWatchlist);
        setWatchlist(updatedWatchlist);
        saveToLocalStorage('watchlist', updatedWatchlist);

        // Обновляем алерты используя setState с callback для получения актуального состояния
        setAlerts(prevAlerts => {
          console.log('🚨 [UPDATE] Алерты из состояния React:', prevAlerts);
          
          // Убедимся что структура правильная
          const safeAlerts = {
            column1: Array.isArray(prevAlerts?.column1) ? prevAlerts.column1 : [],
            column2: Array.isArray(prevAlerts?.column2) ? prevAlerts.column2 : [],
            column3: Array.isArray(prevAlerts?.column3) ? prevAlerts.column3 : []
          };
          
          console.log('🚨 [UPDATE] Safe alerts:', safeAlerts);
          
          const updatedAlerts = { ...safeAlerts };
          let soundPlayed = false;

          // Обновляем только цены в алертах
          Object.keys(updatedAlerts).forEach(column => {
            console.log(`🚨 [UPDATE] Обрабатываем колонку ${column}, алертов: ${updatedAlerts[column].length}`);
            
            updatedAlerts[column] = updatedAlerts[column].map(alert => {
              const stockData = data.data.find(d => d.symbol === alert.symbol);
              if (stockData) {
                console.log(`💱 [UPDATE] Обновляем ${alert.symbol}: ${alert.currentPrice} → ${stockData.price}`);
                const prevStatus = alert.status;
                const newAlert = { ...alert, currentPrice: stockData.price };
                
                // Определяем статус
                if (stockData.price >= alert.minPrice && stockData.price <= alert.maxPrice) {
                  newAlert.status = 'in-range';
                  newAlert.percentDiff = 0;
                  
                  if (prevStatus !== 'in-range' && prevStatus !== 'pending' && !soundPlayed) {
                    console.log(`🔔 [UPDATE] ${alert.symbol} вошел в диапазон!`);
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
                
                console.log(`💱 [UPDATE] ${alert.symbol}: ${prevStatus} → ${newAlert.status}`);
                return newAlert;
              } else {
                console.log(`⚠️ [UPDATE] Нет данных для ${alert.symbol}`);
              }
              return alert;
            });
          });

          console.log('🚨 [UPDATE] Алерты после обновления:', updatedAlerts);
          saveToLocalStorage('alerts', updatedAlerts);
          return updatedAlerts;
        });
        
        setIsConnected(true);
        console.log('✅ [UPDATE] === ОБНОВЛЕНИЕ ЗАВЕРШЕНО ===');
      }
    } catch (error) {
      console.error('❌ [UPDATE] Ошибка обновления:', error);
      setIsConnected(false);
    }
  };

  const addToWatchlist = async (symbol) => {
    console.log(`➕ [WATCHLIST] Добавляем ${symbol}`);
    if (watchlist.some(s => s.symbol === symbol)) {
      alert(`${symbol} уже в watchlist`);
      return;
    }

    const stockData = await getStockData(symbol);
    if (stockData) {
      const newWatchlist = [...watchlist, stockData];
      console.log('➕ [WATCHLIST] Новый watchlist:', newWatchlist);
      setWatchlist(newWatchlist);
      saveToLocalStorage('watchlist', newWatchlist);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    console.log(`🗑️ [WATCHLIST] Удаляем ${symbol}`);
    const newWatchlist = watchlist.filter(s => s.symbol !== symbol);
    setWatchlist(newWatchlist);
    saveToLocalStorage('watchlist', newWatchlist);
    
    // Удаляем алерты для этой акции
    const newAlerts = { ...alerts };
    Object.keys(newAlerts).forEach(column => {
      newAlerts[column] = newAlerts[column].filter(a => a.symbol !== symbol);
    });
    console.log('🗑️ [ALERTS] Алерты после удаления:', newAlerts);
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
  };

  const createAlert = () => {
    console.log('🆕 [ALERT] === СОЗДАНИЕ АЛЕРТА ===');
    console.log('🆕 [ALERT] Форма:', alertForm);
    console.log('🆕 [ALERT] Текущие алерты ДО создания:', JSON.parse(JSON.stringify(alerts)));
    
    if (!alertForm.symbol || !alertForm.minPrice || !alertForm.maxPrice) {
      console.log('❌ [ALERT] Не все поля заполнены');
      alert('Заполните все поля');
      return;
    }

    const minPrice = parseFloat(alertForm.minPrice);
    const maxPrice = parseFloat(alertForm.maxPrice);

    if (minPrice >= maxPrice) {
      console.log('❌ [ALERT] Min >= Max');
      alert('Минимальная цена должна быть меньше максимальной');
      return;
    }

    const stock = watchlist.find(s => s.symbol === alertForm.symbol);
    if (!stock) {
      console.log('❌ [ALERT] Акция не в watchlist');
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

    // Определяем начальный статус
    if (stock.price >= minPrice && stock.price <= maxPrice) {
      newAlert.status = 'in-range';
    } else if (stock.price > maxPrice) {
      newAlert.status = 'above';
      newAlert.percentDiff = ((stock.price - maxPrice) / maxPrice * 100).toFixed(1);
    } else {
      newAlert.status = 'below';
      newAlert.percentDiff = ((minPrice - stock.price) / minPrice * 100).toFixed(1);
    }

    console.log('🆕 [ALERT] Новый алерт:', newAlert);

    // Добавляем в первую колонку
    const newAlerts = { 
      ...alerts,
      column1: [...(alerts.column1 || []), newAlert]
    };
    
    console.log('🆕 [ALERT] Алерты ПОСЛЕ добавления:', newAlerts);
    
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
    setShowAlertModal(false);
    setAlertForm({ symbol: '', minPrice: '', maxPrice: '' });
    
    console.log('✅ [ALERT] === АЛЕРТ СОЗДАН ===');
  };

  const deleteAlert = (columnKey, alertId) => {
    console.log(`🗑️ [ALERT] Удаляем алерт ${alertId} из ${columnKey}`);
    const newAlerts = { ...alerts };
    newAlerts[columnKey] = newAlerts[columnKey].filter(a => a.id !== alertId);
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
  };

  // Drag & Drop функции
  const handleDragStart = (alert, column) => {
    console.log(`🤏 [DRAG] Начинаем перетаскивание ${alert.symbol} из ${column}`);
    setDraggedAlert(alert);
    setDraggedFromColumn(column);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetColumn) => {
    e.preventDefault();
    console.log(`👋 [DROP] Бросаем в ${targetColumn}`);
    
    if (!draggedAlert || !draggedFromColumn) return;
    
    const newAlerts = { ...alerts };
    
    // Удаляем из исходной колонки
    newAlerts[draggedFromColumn] = newAlerts[draggedFromColumn].filter(
      a => a.id !== draggedAlert.id
    );
    
    // Добавляем в целевую колонку
    newAlerts[targetColumn] = [...newAlerts[targetColumn], draggedAlert];
    
    console.log('🤏 [DRAG] Алерты после перетаскивания:', newAlerts);
    setAlerts(newAlerts);
    saveToLocalStorage('alerts', newAlerts);
    setDraggedAlert(null);
    setDraggedFromColumn(null);
  };

  // Effects
  useEffect(() => {
    console.log('🚀 [INIT] === ИНИЦИАЛИЗАЦИЯ КОМПОНЕНТА ===');
    
    const savedWatchlist = loadFromLocalStorage('watchlist', []);
    const savedAlerts = loadFromLocalStorage('alerts', {
      column1: [],
      column2: [],
      column3: []
    });
    
    console.log('🚀 [INIT] Загружен watchlist:', savedWatchlist);
    console.log('🚀 [INIT] Загружены алерты:', savedAlerts);
    
    // Убедимся что структура правильная
    const alertsToSet = {
      column1: Array.isArray(savedAlerts?.column1) ? savedAlerts.column1 : [],
      column2: Array.isArray(savedAlerts?.column2) ? savedAlerts.column2 : [],
      column3: Array.isArray(savedAlerts?.column3) ? savedAlerts.column3 : []
    };

    console.log('🚀 [INIT] Устанавливаем алерты:', alertsToSet);
    
    setWatchlist(savedWatchlist);
    setAlerts(alertsToSet);
    
    console.log('✅ [INIT] === ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
  }, []);

  useEffect(() => {
    console.log('⏰ [INTERVAL] Создаем интервал обновления (каждые 4 сек)');
    
    // Первое обновление через 1 секунду после загрузки
    const firstUpdate = setTimeout(() => {
      console.log('⏰ [INTERVAL] Первое обновление');
      updatePrices();
    }, 1000);
    
    // Регулярные обновления каждые 4 секунды
    const interval = setInterval(() => {
      console.log('⏰ [INTERVAL] Плановое обновление');
      updatePrices();
    }, 4000);
    
    return () => {
      console.log('🛑 [INTERVAL] Очищаем интервалы');
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

  // Компонент алерта
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
      {/* Левая панель - Watchlist */}
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

      {/* Правая область - Алерты */}
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

        {/* Три колонки для алертов */}
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

      {/* Модальное окно для создания алерта */}
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