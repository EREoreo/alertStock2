import React, { useState, useEffect, useRef } from 'react';
import { Search, Settings, BarChart3, Bell, Plus, Trash2, Edit3, Volume2, Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

const StockPriceMonitor = () => {
  // State управление
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [loading, setLoading] = useState({
    search: false,
    watchlist: false,
    adding: false
  });
  const [updateInterval, setUpdateInterval] = useState(1); // секунды
  const [isAutoUpdate, setIsAutoUpdate] = useState(true);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertForm, setAlertForm] = useState({
    symbol: '',
    minPrice: '',
    maxPrice: '',
    currentPrice: 0,
    alertOnEnter: true,
    alertOnExit: true
  });

  // Звуковые уведомления (3 раза подряд)
  const playAlertSound = (type = 'success') => {
    try {
      // Получаем громкость из настроек (по умолчанию 0.8)
      const volume = window.alertVolume || 0.8;
      
      // Играем звук 3 раза с интервалом
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          playSingleSound(type, volume, i + 1);
        }, i * 400); // Каждые 200мс = быстро
      }
      
      console.log(`🔊 Запущен ТРОЙНОЙ звук: ${type} (громкость: ${volume})`);
    } catch (error) {
      console.error('Ошибка воспроизведения звука:', error);
      // Fallback: тройная вибрация
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }
  };

  // Воспроизведение одного звукового сигнала
  const playSingleSound = (type, volume, iteration) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Настройки звука в зависимости от типа
      if (type === 'enter') {
        // Звук входа в диапазон - приятный и громкий
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.4);
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      } else if (type === 'exit') {
        // Звук выхода из диапазона - предупреждающий и громкий
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.4);
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(volume * 1.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      } else {
        // Обычный звук уведомления
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        gainNode.gain.setValueAtTime(volume * 0.9, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      }
      
      oscillator.type = 'sine';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15); // Короче для быстрого повтора
      
      console.log(`🎵 Звук ${iteration}/3: ${type}`);
    } catch (error) {
      console.error(`Ошибка звука ${iteration}:`, error);
    }
  };

  // Показ браузерного уведомления
  const showNotification = (title, message, type = 'info') => {
    try {
      // Проверяем поддержку уведомлений
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          const icon = type === 'enter' ? '🟢' : type === 'exit' ? '🔴' : '📊';
          new Notification(`${icon} ${title}`, {
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `alert-${Date.now()}`,
            requireInteraction: false,
            silent: false
          });
          console.log(`🔔 Показано уведомление: ${title}`);
        } else if (Notification.permission !== 'denied') {
          // Запрашиваем разрешение
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              showNotification(title, message, type);
            }
          });
        }
      }
    } catch (error) {
      console.error('Ошибка показа уведомления:', error);
    }
  };

  // Проверка срабатывания алертов
  const checkAlertTriggers = (updatedAlerts, oldAlerts) => {
    updatedAlerts.forEach(alert => {
      const oldAlert = oldAlerts.find(old => old.id === alert.id);
      if (!oldAlert) return;
      
      const oldStatus = oldAlert.status;
      const newStatus = alert.status;
      
      // Проверяем изменение статуса
      if (oldStatus !== newStatus) {
        const symbol = alert.symbol;
        const currentPrice = alert.currentPrice;
        const range = `${alert.minPrice.toFixed(2)}-${alert.maxPrice.toFixed(2)}`;
        
        console.log(`📊 ${symbol}: ${oldStatus} → ${newStatus} (${currentPrice})`);
        
        // Вход в диапазон
        if (newStatus === 'in-range' && oldStatus !== 'in-range' && alert.alertOnEnter) {
          playAlertSound('enter');
          showNotification(
            `${symbol} entered range!`,
            `Price ${currentPrice.toFixed(2)} is now within ${range}`,
            'enter'
          );
          console.log(`🟢 ${symbol} вошел в диапазон ${range}`);
        }
        
        // Выход из диапазона
        if (oldStatus === 'in-range' && newStatus !== 'in-range' && alert.alertOnExit) {
          playAlertSound('exit');
          const direction = newStatus === 'above' ? 'above' : 'below';
          showNotification(
            `${symbol} exited range!`,
            `Price ${currentPrice.toFixed(2)} is now ${direction} ${range}`,
            'exit'
          );
          console.log(`🔴 ${symbol} вышел из диапазона ${range} (${direction})`);
        }
      }
    });
  };
  const saveToLocalStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`💾 Сохранено в localStorage: ${key}`, data);
    } catch (error) {
      console.error('Ошибка сохранения в localStorage:', error);
    }
  };

  const loadFromLocalStorage = (key, defaultValue = []) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`📂 Загружено из localStorage: ${key}`, parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Ошибка загрузки из localStorage:', error);
    }
    return defaultValue;
  };

  // API функции
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Поиск тикеров
  const searchTickers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(prev => ({ ...prev, search: true }));
    try {
      const response = await apiCall(`/search/${encodeURIComponent(query)}`);
      if (response.success) {
        setSearchResults(response.results);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(prev => ({ ...prev, search: false }));
    }
  };

  // Получение данных одной акции
  const getStockData = async (symbol) => {
    try {
      const response = await apiCall(`/stock/${symbol}`);
      if (response.success) {
        return {
          symbol: response.data.symbol,
          name: getCompanyName(response.data.symbol),
          price: response.data.price,
          change: response.data.change,
          changePercent: response.data.changePercent,
          lastUpdate: response.data.lastUpdate
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
      return null;
    }
  };

  // Получение данных нескольких акций
  const updateWatchlistPrices = async () => {
    if (!watchlist || watchlist.length === 0) return;

    setLoading(prev => ({ ...prev, watchlist: true }));
    
    try {
      const symbols = watchlist.map(stock => stock.symbol);
      const response = await apiCall('/stocks/batch', {
        method: 'POST',
        body: JSON.stringify({ symbols })
      });

      if (response.success) {
        const updatedWatchlist = watchlist.map(stock => {
          const newData = response.data.find(item => item.symbol === stock.symbol);
          if (newData) {
            return {
              ...stock,
              price: newData.price,
              change: newData.change,
              changePercent: newData.changePercent,
              lastUpdate: newData.lastUpdate
            };
          }
          return stock;
        });

        setWatchlist(updatedWatchlist);
        setLastUpdate(new Date().toLocaleTimeString());
        setIsConnected(true);
        
        // Сохраняем обновленный watchlist
        saveToLocalStorage('watchlist', updatedWatchlist);
        
        // Обновляем цены в алертах
        updateAlertPrices(updatedWatchlist);
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
      setIsConnected(false);
    } finally {
      setLoading(prev => ({ ...prev, watchlist: false }));
    }
  };

  // Обновление алертов с пересчетом статуса и сохранением
  const updateAlertPrices = (stocks) => {
    setAlerts(prevAlerts => {
      const updatedAlerts = prevAlerts.map(alert => {
        const stock = stocks.find(s => s.symbol === alert.symbol);
        if (stock) {
          const newStatus = getRangeStatus(stock.price, alert.minPrice, alert.maxPrice);
          return { 
            ...alert, 
            currentPrice: stock.price,
            status: newStatus,
            lastUpdate: new Date().toLocaleString()
          };
        }
        return alert;
      });
      
      // Проверяем срабатывание алертов только если есть предыдущие данные
      if (prevAlerts.length > 0 && prevAlerts.some(alert => alert.currentPrice > 0)) {
        checkAlertTriggers(updatedAlerts, prevAlerts);
      }
      
      // Сохраняем обновленные алерты
      saveToLocalStorage('alerts', updatedAlerts);
      return updatedAlerts;
    });
  };

  // Добавление акции в watchlist
  const addToWatchlist = async (symbol) => {
    console.log(`🔄 Добавление ${symbol} в watchlist...`);
    
    // Проверяем, есть ли уже такая акция
    if (watchlist.some(stock => stock.symbol === symbol)) {
      console.log(`⚠️ ${symbol} уже в watchlist!`);
      alert(`${symbol} уже в watchlist!`);
      return;
    }

    setLoading(prev => ({ ...prev, adding: true }));
    try {
      const stockData = await getStockData(symbol);
      console.log(`📊 Данные для ${symbol}:`, stockData);
      
      if (stockData) {
        const newWatchlist = [...watchlist, stockData];
        setWatchlist(newWatchlist);
        
        // Сохраняем в localStorage
        saveToLocalStorage('watchlist', newWatchlist);
        
        setSearchQuery('');
        setSearchResults([]);
        console.log(`✅ ${symbol} успешно добавлен в watchlist и сохранен!`);
      } else {
        console.error(`❌ Не удалось получить данные для ${symbol}`);
        alert(`Не удалось получить данные для ${symbol}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка добавления ${symbol}:`, error);
      alert(`Ошибка при добавлении ${symbol}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, adding: false }));
    }
  };

  // Удаление акции из watchlist
  const removeFromWatchlist = (symbol) => {
    const newWatchlist = watchlist.filter(stock => stock.symbol !== symbol);
    const newAlerts = alerts.filter(alert => alert.symbol !== symbol);
    
    setWatchlist(newWatchlist);
    setAlerts(newAlerts);
    
    // Сохраняем в localStorage
    saveToLocalStorage('watchlist', newWatchlist);
    saveToLocalStorage('alerts', newAlerts);
    
    console.log(`🗑️ ${symbol} удален из watchlist и localStorage`);
  };

  // Заглушка для получения названия компании
  const getCompanyName = (symbol) => {
    const names = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corporation',
      'GOOGL': 'Alphabet Inc.',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'META': 'Meta Platforms Inc.',
      'NVDA': 'NVIDIA Corporation',
      'NFLX': 'Netflix Inc.'
    };
    return names[symbol] || `${symbol} Inc.`;
  };

  // Ручное обновление цен
  const handleManualUpdate = async () => {
    console.log('🔄 Ручное обновление цен...');
    await updateWatchlistPrices();
  };

  // Переключение автообновления
  const toggleAutoUpdate = () => {
    const newAutoUpdate = !isAutoUpdate;
    setIsAutoUpdate(newAutoUpdate);
    
    // Сохраняем настройку
    saveToLocalStorage('isAutoUpdate', newAutoUpdate);
    
    console.log(`🔄 Автообновление ${newAutoUpdate ? 'включено' : 'выключено'} и сохранено`);
  };

  // Управление модальным окном алертов
  const openAlertModal = () => {
    setShowAlertModal(true);
    // Сброс формы
    setAlertForm({
      symbol: watchlist.length > 0 ? watchlist[0].symbol : '',
      minPrice: '',
      maxPrice: '',
      currentPrice: watchlist.length > 0 ? watchlist[0].price : 0,
      alertOnEnter: true,
      alertOnExit: true
    });
  };

  const closeAlertModal = () => {
    setShowAlertModal(false);
    setAlertForm({
      symbol: '',
      minPrice: '',
      maxPrice: '',
      currentPrice: 0,
      alertOnEnter: true,
      alertOnExit: true
    });
  };

  // Обработка изменений в форме алерта
  const handleAlertFormChange = (field, value) => {
    setAlertForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // Если изменился символ, обновляем текущую цену
      if (field === 'symbol') {
        const selectedStock = watchlist.find(stock => stock.symbol === value);
        if (selectedStock) {
          updated.currentPrice = selectedStock.price;
        }
      }
      
      return updated;
    });
  };

  // Создание нового алерта
  const createAlert = () => {
    if (!alertForm.symbol || !alertForm.minPrice || !alertForm.maxPrice) {
      alert('Пожалуйста, заполните все поля');
      return;
    }

    const minPrice = parseFloat(alertForm.minPrice);
    const maxPrice = parseFloat(alertForm.maxPrice);
    
    if (isNaN(minPrice) || isNaN(maxPrice) || minPrice <= 0 || maxPrice <= 0) {
      alert('Пожалуйста, введите корректные цены');
      return;
    }

    if (minPrice >= maxPrice) {
      alert('Минимальная цена должна быть меньше максимальной');
      return;
    }

    const newAlert = {
      id: Date.now(),
      symbol: alertForm.symbol,
      minPrice: minPrice,
      maxPrice: maxPrice,
      currentPrice: alertForm.currentPrice,
      alertOnEnter: alertForm.alertOnEnter,
      alertOnExit: alertForm.alertOnExit,
      created: new Date().toLocaleString(),
      status: getRangeStatus(alertForm.currentPrice, minPrice, maxPrice),
      lastUpdate: new Date().toLocaleString()
    };

    const newAlerts = [...alerts, newAlert];
    setAlerts(newAlerts);
    
    // Сохраняем в localStorage
    saveToLocalStorage('alerts', newAlerts);
    
    closeAlertModal();
    
    console.log('✅ Новый алерт создан и сохранен:', newAlert);
  };

  // Определение статуса цены относительно диапазона
  const getRangeStatus = (currentPrice, minPrice, maxPrice) => {
    if (currentPrice < minPrice) return 'below'; // 🔴 Ниже диапазона
    if (currentPrice > maxPrice) return 'above';  // 🔵 Выше диапазона
    return 'in-range'; // 🟢 В диапазоне
  };

  // Получение цвета и текста статуса
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'below':
        return { color: 'text-red-400', bg: 'bg-red-500/20', text: '🔴 Below Range', icon: '🔴' };
      case 'above':
        return { color: 'text-blue-400', bg: 'bg-blue-500/20', text: '🔵 Above Range', icon: '🔵' };
      case 'in-range':
        return { color: 'text-green-400', bg: 'bg-green-500/20', text: '🟢 In Range', icon: '🟢' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-500/20', text: '⚪ Unknown', icon: '⚪' };
    }
  };

  // Проверка здоровья API
  const checkApiHealth = async () => {
    try {
      const response = await apiCall('/health');
      setIsConnected(response.success);
    } catch (error) {
      setIsConnected(false);
    }
  };

  // Effects
  useEffect(() => {
    checkApiHealth();
    
    // Запрашиваем разрешение на уведомления при загрузке
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log(`🔔 Разрешение на уведомления: ${permission}`);
      });
    }
    
    // Загружаем данные из localStorage при запуске
    console.log('🚀 Загрузка данных из localStorage...');
    const savedWatchlist = loadFromLocalStorage('watchlist', []);
    const savedAlerts = loadFromLocalStorage('alerts', []);
    const savedUpdateInterval = loadFromLocalStorage('updateInterval', 1);
    const savedAutoUpdate = loadFromLocalStorage('isAutoUpdate', true);
    
    if (savedWatchlist.length > 0) {
      setWatchlist(savedWatchlist);
      console.log(`✅ Восстановлено ${savedWatchlist.length} акций в watchlist`);
    }
    
    if (savedAlerts.length > 0) {
      setAlerts(savedAlerts);
      console.log(`✅ Восстановлено ${savedAlerts.length} алертов`);
    }
    
    setUpdateInterval(savedUpdateInterval);
    setIsAutoUpdate(savedAutoUpdate);
    
    console.log('📋 Все данные восстановлены из localStorage');
  }, []);

  // Загружаем начальные данные после монтирования компонента
  useEffect(() => {
    const loadInitialStocks = async () => {
      console.log('🚀 Загрузка начальных акций...');
      const initialStocks = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'];
      for (const symbol of initialStocks) {
        await addToWatchlist(symbol);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Увеличил задержку
      }
      console.log('✅ Начальные акции загружены!');
    };
    
    // Убираем автозагрузку для отладки
    // loadInitialStocks();
  }, []);

  // Effects для автообновления
  useEffect(() => {
    let interval;
    
    // НЕ запускаем автообновление если открыто модальное окно
    if (watchlist && watchlist.length > 0 && isAutoUpdate && !showAlertModal) {
      // Сразу обновляем цены при изменении watchlist
      updateWatchlistPrices();
      
      // Устанавливаем интервал обновления
      interval = setInterval(() => {
        console.log(`🔄 Автообновление цен (каждые ${updateInterval} сек)...`);
        updateWatchlistPrices();
      }, updateInterval * 1000);
      
      console.log(`✅ Автообновление включено: каждые ${updateInterval} секунд`);
    } else if (!isAutoUpdate) {
      console.log('⏸️ Автообновление приостановлено');
    } else if (showAlertModal) {
      console.log('⏸️ Автообновление остановлено - модальное окно открыто');
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
        console.log('🛑 Интервал автообновления очищен');
      }
    };
  }, [watchlist?.length, updateInterval, isAutoUpdate, showAlertModal]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery) {
        searchTickers(searchQuery);
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  // Подсчет статистики
  const getStockStats = () => {
    if (!watchlist || watchlist.length === 0) {
      return { positiveStocks: 0, negativeStocks: 0 };
    }
    
    const positiveStocks = watchlist.filter(stock => stock.change >= 0).length;
    const negativeStocks = watchlist.filter(stock => stock.change < 0).length;
    
    return { positiveStocks, negativeStocks };
  };

  const { positiveStocks, negativeStocks } = getStockStats();

  // Компонент карточки акции
  const StockCard = ({ stock }) => {
    const isPositive = stock.change >= 0;
    
    return (
      <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors relative group">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-white font-semibold text-lg">{stock.symbol}</h3>
            <p className="text-gray-400 text-sm">{stock.name}</p>
          </div>
          <div className="flex space-x-2">
            <Bell className="w-5 h-5 text-gray-400 hover:text-yellow-500 cursor-pointer" />
            <button
              onClick={() => removeFromWatchlist(stock.symbol)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
            </button>
          </div>
        </div>
        
        <div className="mt-3">
          <div className="text-white text-2xl font-bold mb-1">
            ${stock.price?.toFixed(2) || '---'}
          </div>
          <div className={`flex items-center space-x-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {isPositive ? '+' : ''}{stock.change?.toFixed(2) || '0.00'}
            </span>
            <span className="text-sm">
              ({isPositive ? '+' : ''}{stock.changePercent?.toFixed(2) || '0.00'}%)
            </span>
          </div>
        </div>
        
        {stock.lastUpdate && (
          <div className="mt-2 text-xs text-gray-500">
            Updated: {stock.lastUpdate}
          </div>
        )}
      </div>
    );
  };

  // Компонент модального окна для создания алертов
  const AlertModal = () => {
    if (!showAlertModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-600 relative z-50">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-white">Add Price Alert</h3>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-yellow-400">⏸️ Auto-update paused</span>
              <button
                onClick={closeAlertModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Select Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Stock
              </label>
              <select
                value={alertForm.symbol}
                onChange={(e) => handleAlertFormChange('symbol', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:border-blue-500"
              >
                {watchlist.length === 0 ? (
                  <option value="">No stocks in watchlist</option>
                ) : (
                  watchlist.map(stock => (
                    <option key={stock.symbol} value={stock.symbol}>
                      {stock.symbol} - {stock.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Price Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={alertForm.minPrice}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Разрешаем только цифры, точку и запятую
                        if (/^[0-9]*[.,]?[0-9]*$/.test(value) || value === '') {
                          handleAlertFormChange('minPrice', value.replace(',', '.'));
                        }
                      }}
                      onBlur={(e) => {
                        // При потере фокуса форматируем цену
                        const value = parseFloat(e.target.value) || 0;
                        handleAlertFormChange('minPrice', value.toFixed(2));
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={alertForm.maxPrice}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Разрешаем только цифры, точку и запятую
                        if (/^[0-9]*[.,]?[0-9]*$/.test(value) || value === '') {
                          handleAlertFormChange('maxPrice', value.replace(',', '.'));
                        }
                      }}
                      onBlur={(e) => {
                        // При потере фокуса форматируем цену
                        const value = parseFloat(e.target.value) || 0;
                        handleAlertFormChange('maxPrice', value.toFixed(2));
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Alert Options */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Alert When
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={alertForm.alertOnEnter}
                    onChange={(e) => handleAlertFormChange('alertOnEnter', e.target.checked)}
                    className="mr-3 w-4 h-4 text-green-500"
                  />
                  <span className="text-green-400">🟢 Enters range (price moves into range)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={alertForm.alertOnExit}
                    onChange={(e) => handleAlertFormChange('alertOnExit', e.target.checked)}
                    className="mr-3 w-4 h-4 text-red-500"
                  />
                  <span className="text-red-400">🔴🔵 Exits range (price moves out of range)</span>
                </label>
              </div>
              
              {/* Test Sound Buttons */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">Volume:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    defaultValue="0.8"
                    onChange={(e) => {
                      window.alertVolume = parseFloat(e.target.value);
                      console.log(`🔊 Громкость установлена: ${window.alertVolume}`);
                    }}
                    className="w-16 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-400">🔊</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => playAlertSound('enter')}
                    className="px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded transition-colors flex items-center space-x-1"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Test Enter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playAlertSound('exit')}
                    className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded transition-colors flex items-center space-x-1"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Test Exit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Current Status */}
            {alertForm.symbol && alertForm.minPrice && alertForm.maxPrice && (
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-300 mb-2">
                  Current Price: <span className="text-white font-semibold">${alertForm.currentPrice?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="text-sm mb-2">
                  Range: <span className="text-white">${alertForm.minPrice || '0.00'} - ${alertForm.maxPrice || '0.00'}</span>
                </div>
                {(() => {
                  const minPrice = parseFloat(alertForm.minPrice) || 0;
                  const maxPrice = parseFloat(alertForm.maxPrice) || 0;
                  const currentPrice = alertForm.currentPrice || 0;
                  const status = getRangeStatus(currentPrice, minPrice, maxPrice);
                  const statusDisplay = getStatusDisplay(status);
                  
                  return (
                    <div className={`inline-block px-2 py-1 rounded text-sm ${statusDisplay.bg} ${statusDisplay.color}`}>
                      {statusDisplay.text}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={closeAlertModal}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createAlert}
              disabled={!alertForm.symbol || !alertForm.minPrice || !alertForm.maxPrice}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <Bell className="w-4 h-4" />
              <span>Create Alert</span>
            </button>
          </div>
        </div>
      </div>
    );
  };
  const SearchResult = ({ symbol, onAdd }) => (
    <div className="flex justify-between items-center p-2 hover:bg-gray-700 cursor-pointer rounded">
      <div onClick={() => onAdd(symbol)} className="flex-1">
        <span className="text-white font-medium">{symbol}</span>
        <span className="text-gray-400 text-sm ml-2">{getCompanyName(symbol)}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd(symbol);
        }}
        className="flex items-center justify-center w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        disabled={loading.adding}
      >
        {loading.adding ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : (
          <Plus className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white w-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-8 h-8 text-blue-500" />
            <h1 className="text-xl font-bold">Stock Price Monitor</h1>
            <span className="flex items-center space-x-2 text-green-400 text-sm">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </span>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Add New Stock */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Add New Stock</h2>
            <div className="relative">
              <div className="flex space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search stocks by symbol or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {loading.search && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => searchTickers(searchQuery)}
                  disabled={loading.search}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <Search className="w-5 h-5" />
                  <span>Search</span>
                </button>
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-10 max-h-60 overflow-y-auto">
                  {searchResults.map(symbol => (
                    <SearchResult 
                      key={symbol} 
                      symbol={symbol} 
                      onAdd={(sym) => {
                        console.log(`🎯 Клик по ${sym}`);
                        addToWatchlist(sym);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Watchlist */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Watchlist ({watchlist?.length || 0})</h2>
              <div className="flex items-center space-x-3">
                {/* Кнопка ручного обновления */}
                <button
                  onClick={handleManualUpdate}
                  disabled={loading.watchlist}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg text-sm transition-colors flex items-center space-x-2"
                >
                  <Loader2 className={`w-4 h-4 ${loading.watchlist ? 'animate-spin' : ''}`} />
                  <span>Update</span>
                </button>
                
                {/* Переключатель автообновления */}
                <button
                  onClick={toggleAutoUpdate}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    isAutoUpdate 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {isAutoUpdate ? '🔄 Auto ON' : '⏸️ Auto OFF'}
                </button>
                
                {loading.watchlist && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                )}
              </div>
            </div>
            
            {!watchlist || watchlist.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No stocks in watchlist</p>
                <p className="text-sm">Search and add stocks to start monitoring</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {watchlist.map((stock) => (
                  <StockCard key={stock.symbol} stock={stock} />
                ))}
              </div>
            )}
          </section>

          {/* Status Bar */}
          <div className="mt-8 flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <span>📊 {watchlist?.length || 0} stocks tracked</span>
              <span>⚠️ {alerts?.length || 0} active alerts</span>
              {showAlertModal && (
                <span className="text-yellow-400 text-xs">⏸️ Auto-update paused</span>
              )}
              <div className="flex items-center space-x-2">
                <span>🔄</span>
                <select 
                  value={updateInterval} 
                  onChange={(e) => {
                    const newInterval = Number(e.target.value);
                    setUpdateInterval(newInterval);
                    // Сохраняем настройку
                    saveToLocalStorage('updateInterval', newInterval);
                    console.log(`⏱️ Интервал обновления изменен на ${newInterval}с и сохранен`);
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs"
                  disabled={showAlertModal}
                >
                  <option value={1}>1s</option>
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                  <option value={300}>5m</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span>Last update: {lastUpdate || 'Never'}</span>
              {isAutoUpdate && !showAlertModal && (
                <span className="text-green-400 text-xs">
                  Next: {updateInterval}s
                </span>
              )}
              {showAlertModal && (
                <span className="text-yellow-400 text-xs">
                  ⏸️ Paused for input
                </span>
              )}
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-80 bg-gray-800 border-l border-gray-700 p-6">
          {/* Price Alerts */}
          <section className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Price Alerts</h3>
              <button 
                onClick={openAlertModal}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Alert</span>
              </button>
            </div>
            <div>
              {!alerts || alerts.length === 0 ? (
                <p className="text-gray-400 text-sm">No active alerts</p>
              ) : (
                alerts.map((alert) => {
                  const status = alert.status || getRangeStatus(alert.currentPrice, alert.minPrice, alert.maxPrice);
                  const statusDisplay = getStatusDisplay(status);
                  
                  return (
                    <div key={alert.id} className="bg-gray-700 rounded-lg p-3 mb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-semibold">{alert.symbol}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color}`}>
                            {statusDisplay.icon} {status === 'below' ? 'Below' : status === 'above' ? 'Above' : 'In Range'}
                          </span>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              // Тестовое уведомление для данного алерта
                              playAlertSound(alert.status === 'in-range' ? 'enter' : 'exit');
                              showNotification(
                                `${alert.symbol} Alert Test`,
                                `Current: ${alert.currentPrice?.toFixed(2)} | Range: ${alert.minPrice.toFixed(2)}-${alert.maxPrice.toFixed(2)}`,
                                alert.status === 'in-range' ? 'enter' : 'exit'
                              );
                            }}
                            className="p-1 rounded hover:bg-gray-600"
                            title="Test Alert Sound"
                          >
                            <Volume2 className="w-3 h-3 text-gray-400 hover:text-yellow-400" />
                          </button>
                          <Edit3 className="w-4 h-4 text-gray-400 hover:text-blue-400 cursor-pointer" />
                          <Trash2 
                            className="w-4 h-4 text-gray-400 hover:text-red-400 cursor-pointer" 
                            onClick={() => {
                              const newAlerts = alerts.filter(a => a.id !== alert.id);
                              setAlerts(newAlerts);
                              saveToLocalStorage('alerts', newAlerts);
                              console.log(`🗑️ Алерт ${alert.symbol} удален`);
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        <div>Range: ${alert.minPrice.toFixed(2)} - ${alert.maxPrice.toFixed(2)}</div>
                        <div>Current: ${alert.currentPrice?.toFixed(2) || '---'}</div>
                        <div className="text-xs mt-1">
                          Alerts: {alert.alertOnEnter && '🟢 Enter'} {alert.alertOnEnter && alert.alertOnExit && '+'} {alert.alertOnExit && '🔴 Exit'}
                        </div>
                        {alert.lastUpdate && (
                          <div className="text-xs text-gray-500 mt-1">
                            Updated: {alert.lastUpdate}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Market Summary */}
          <section>
            <h3 className="text-lg font-semibold mb-4">Market Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Tracked Stocks</span>
                <span className="font-semibold">{watchlist?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Alerts</span>
                <span className="font-semibold">{alerts?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Positive</span>
                <span className="font-semibold text-green-400">{positiveStocks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Negative</span>
                <span className="font-semibold text-red-400">{negativeStocks}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-500">
                Last update: {lastUpdate || 'Never'}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Alert Modal */}
      <AlertModal />
    </div>
  );
};

export default StockPriceMonitor;