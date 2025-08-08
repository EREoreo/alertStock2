import fs from 'fs';
import https from 'https';

// Конфигурация
const config = {
    baseUrl: 'https://elite.finviz.com/quote_export.ashx',
    auth: '56d25c88-21a3-47a8-ad5a-605f01591d43',
    symbol: 'MSFT'
};

// Функция для получения цены акции
async function getStockPrice(symbol) {
    return new Promise((resolve, reject) => {
        const url = `${config.baseUrl}?t=${symbol}&auth=${config.auth}`;
        
        console.log(`Запрос к: ${url}`);
        
        https.get(url, (response) => {
            let data = '';
            
            // Получаем данные по частям
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            // Когда все данные получены
            response.on('end', () => {
                try {
                    if (response.statusCode === 200) {
                        // Парсим CSV данные (исторические данные)
                        const lines = data.trim().split('\n');
                        
                        if (lines.length >= 1) {
                            // Берем последнюю строку (самые свежие данные)
                            const lastLine = lines[lines.length - 1];
                            const values = lastLine.split(',');
                            
                            // Формат: Date,Open,High,Low,Close,Volume
                            if (values.length >= 5) {
                                const date = values[0];
                                const open = values[1];
                                const high = values[2];
                                const low = values[3];
                                const close = values[4]; // Цена закрытия (текущая цена)
                                const volume = values[5];
                                
                                console.log(`\n📈 ${symbol} - Текущая цена: ${close}`);
                                console.log(`📅 Дата: ${date}`);
                                console.log(`📊 Детали торгов:`);
                                console.log(`   • Открытие: ${open}`);
                                console.log(`   • Максимум: ${high}`);
                                console.log(`   • Минимум: ${low}`);
                                console.log(`   • Закрытие: ${close}`);
                                console.log(`   • Объем: ${volume}`);
                                
                                resolve({ 
                                    symbol, 
                                    price: close,
                                    date,
                                    open,
                                    high, 
                                    low,
                                    volume 
                                });
                            } else {
                                console.log('❌ Некорректный формат данных CSV');
                                console.log('📄 Последняя строка:', lastLine);
                                reject(new Error('Некорректный формат CSV данных'));
                            }
                        } else {
                            console.log('❌ Пустой ответ от сервера');
                            console.log('📄 Полученные данные:', data);
                            reject(new Error('Пустой ответ'));
                        }
                    } else {
                        console.log(`❌ HTTP ошибка: ${response.statusCode}`);
                        console.log('📄 Ответ сервера:', data);
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                    }
                } catch (error) {
                    console.log('❌ Ошибка парсинга:', error.message);
                    console.log('📄 Сырые данные:', data.substring(0, 500) + '...');
                    reject(error);
                }
            });
            
        }).on('error', (error) => {
            console.log('❌ Ошибка сети:', error.message);
            reject(error);
        });
    });
}

// Функция для получения только текущей цены (краткий вывод)
async function getCurrentPrice(symbol) {
    try {
        const result = await getStockPrice(symbol);
        console.log(`💰 ${symbol}: ${result.price}`);
        return result.price;
    } catch (error) {
        console.log(`❌ ${symbol}: Ошибка - ${error.message}`);
        return null;
    }
}

// Функция для получения данных нескольких акций
async function getMultipleStocks(symbols) {
    console.log('🚀 Начинаем получение данных...\n');
    
    for (const symbol of symbols) {
        try {
            await getStockPrice(symbol);
            console.log('─'.repeat(50));
        } catch (error) {
            console.log(`❌ Ошибка для ${symbol}:`, error.message);
            console.log('─'.repeat(50));
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Функция для автоматического запуска каждые 30 секунд
function startPriceMonitoring(symbols = [config.symbol], intervalSeconds = 30) {
    console.log(`🚀 Запуск мониторинга цен каждые ${intervalSeconds} секунд...`);
    console.log(`📊 Отслеживаемые акции: ${symbols.join(', ')}`);
    console.log(`⏰ Время старта: ${new Date().toLocaleString()}`);
    console.log('─'.repeat(60));
    
    // Первый запуск сразу
    monitorPrices(symbols);
    
    // Устанавливаем интервал
    const interval = setInterval(() => {
        monitorPrices(symbols);
    }, intervalSeconds * 1000);
    
    // Возвращаем функцию для остановки мониторинга
    return () => {
        clearInterval(interval);
        console.log('\n🛑 Мониторинг остановлен');
    };
}

// Функция для мониторинга цен (вызывается каждые 30 сек)
async function monitorPrices(symbols) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n🕐 ${timestamp} - Обновление цен:`);
    
    for (const symbol of symbols) {
        try {
            const result = await getCurrentPrice(symbol);
            // getCurrentPrice уже выводит цену, просто добавляем разделитель
        } catch (error) {
            console.log(`❌ ${symbol}: Ошибка - ${error.message}`);
        }
        
        // Небольшая задержка между запросами для разных акций
        if (symbols.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    console.log('─'.repeat(40));
}

// Основная функция
async function main() {
    console.log('🎯 FinViz Elite Price Monitor');
    console.log('='.repeat(50));
    
    // Выберите режим работы:
    const mode = process.argv[2] || 'once'; // 'once', 'monitor', 'test'
    
    switch (mode) {
        case 'monitor':
            // Автоматический мониторинг каждые 30 секунд
            console.log('📈 Режим: Автоматический мониторинг');
            const stopMonitoring = startPriceMonitoring([config.symbol], 30);
            
            // Обработка Ctrl+C для остановки
            process.on('SIGINT', () => {
                console.log('\n\n🛑 Получен сигнал остановки...');
                stopMonitoring();
                process.exit(0);
            });
            break;
            
        case 'multi':
            // Мониторинг нескольких акций
            console.log('📊 Режим: Мониторинг нескольких акций');
            const symbols = ['MSFT', 'AAPL', 'GOOGL', 'TSLA'];
            const stopMulti = startPriceMonitoring(symbols, 30);
            
            process.on('SIGINT', () => {
                console.log('\n\n🛑 Получен сигнал остановки...');
                stopMulti();
                process.exit(0);
            });
            break;
            
        case 'test':
            // Тестовый режим - один раз подробно
            console.log('🔍 Режим: Тестирование');
            try {
                await getStockPrice(config.symbol);
                console.log('\n💰 Краткий вывод:');
                await getCurrentPrice(config.symbol);
            } catch (error) {
                console.log('💥 Ошибка:', error.message);
            }
            break;
            
        default:
            // Одноразовый запуск (по умолчанию)
            console.log('⚡ Режим: Одноразовый запуск');
            try {
                await getCurrentPrice(config.symbol);
                
                console.log('\n💡 Доступные команды:');
                console.log('  node server.js monitor  - автоматический мониторинг каждые 30 сек');
                console.log('  node server.js multi    - мониторинг нескольких акций');
                console.log('  node server.js test     - подробная информация');
                console.log('  node server.js          - одноразовый запуск (по умолчанию)');
            } catch (error) {
                console.log('💥 Ошибка:', error.message);
            }
            break;
    }
}

// Экспорт функций для использования в других файлах
export {
    getStockPrice,
    getCurrentPrice,
    getMultipleStocks,
    startPriceMonitoring,
    monitorPrices,
    config
};

// Запуск если файл вызван напрямую
main();