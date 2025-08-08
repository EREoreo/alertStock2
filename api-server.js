import express from 'express';
import cors from 'cors';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist directory (React build)
app.use(express.static(path.join(__dirname, 'dist')));

// FinViz конфигурация
const config = {
    baseUrl: 'https://elite.finviz.com/quote_export.ashx',
    auth: process.env.FINVIZ_API_KEY || '56d25c88-21a3-47a8-ad5a-605f01591d43'
};

// Функция для получения цены акции
async function getStockPrice(symbol) {
    return new Promise((resolve, reject) => {
        const url = `${config.baseUrl}?t=${symbol}&auth=${config.auth}`;
        
        https.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    if (response.statusCode === 200) {
                        const lines = data.trim().split('\n');
                        
                        if (lines.length >= 1) {
                            const lastLine = lines[lines.length - 1];
                            const values = lastLine.split(',');
                            
                            if (values.length >= 5) {
                                const date = values[0];
                                const open = parseFloat(values[1]);
                                const high = parseFloat(values[2]);
                                const low = parseFloat(values[3]);
                                const close = parseFloat(values[4]);
                                const volume = parseInt(values[5]);
                                
                                // Вычисляем изменение (примерное, на основе open и close)
                                const change = close - open;
                                const changePercent = ((change / open) * 100);
                                
                                resolve({
                                    symbol,
                                    price: close,
                                    change: change,
                                    changePercent: changePercent,
                                    date,
                                    open,
                                    high,
                                    low,
                                    volume,
                                    lastUpdate: new Date().toLocaleTimeString()
                                });
                            } else {
                                reject(new Error('Некорректный формат CSV данных'));
                            }
                        } else {
                            reject(new Error('Пустой ответ'));
                        }
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                    }
                } catch (error) {
                    reject(error);
                }
            });
            
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Функция для загрузки тикеров из CSV файлов
async function loadTickers() {
    try {
        const nasdaqData = await fs.promises.readFile(
            path.join(__dirname, 'all nasdaq.csv'), 'utf-8'
        );
        const nyseData = await fs.promises.readFile(
            path.join(__dirname, 'all nyse.csv'), 'utf-8'
        );
        
        const nasdaqTickers = nasdaqData.split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== 'Ticker');
            
        const nyseTickers = nyseData.split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== 'Ticker');
            
        return {
            nasdaq: nasdaqTickers,
            nyse: nyseTickers,
            all: [...nasdaqTickers, ...nyseTickers]
        };
    } catch (error) {
        console.log('❌ Ошибка загрузки тикеров:', error.message);
        return { nasdaq: [], nyse: [], all: [] };
    }
}

// Функция для поиска тикеров
async function searchTickers(query) {
    const tickers = await loadTickers();
    const searchQuery = query.toUpperCase();
    
    const exactMatch = tickers.all.find(ticker => ticker === searchQuery);
    if (exactMatch) {
        return [exactMatch];
    }
    
    const partialMatches = tickers.all
        .filter(ticker => ticker.includes(searchQuery))
        .slice(0, 10);
        
    return partialMatches;
}

// API Routes

// Поиск тикеров
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const results = await searchTickers(query);
        
        res.json({
            success: true,
            query,
            results,
            count: results.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение цены одной акции
app.get('/api/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const stockData = await getStockPrice(symbol.toUpperCase());
        
        res.json({
            success: true,
            data: stockData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            symbol: req.params.symbol
        });
    }
});

// Получение цен нескольких акций
app.post('/api/stocks/batch', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!Array.isArray(symbols)) {
            return res.status(400).json({
                success: false,
                error: 'symbols должен быть массивом'
            });
        }
        
        const promises = symbols.map(symbol => 
            getStockPrice(symbol.toUpperCase()).catch(error => ({
                symbol: symbol.toUpperCase(),
                error: error.message
            }))
        );
        
        const results = await Promise.all(promises);
        
        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);
        
        res.json({
            success: true,
            data: successful,
            failed: failed,
            count: successful.length,
            failedCount: failed.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение всех доступных тикеров
app.get('/api/tickers', async (req, res) => {
    try {
        const tickers = await loadTickers();
        
        res.json({
            success: true,
            data: {
                nasdaq: {
                    count: tickers.nasdaq.length,
                    tickers: tickers.nasdaq.slice(0, 100) // Первые 100 для примера
                },
                nyse: {
                    count: tickers.nyse.length,
                    tickers: tickers.nyse.slice(0, 100) // Первые 100 для примера
                },
                total: tickers.all.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Catch-all handler: отправляем React приложение для всех не-API маршрутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('\n📋 Доступные endpoints:');
    console.log(`  GET  /api/health                    - проверка работоспособности`);
    console.log(`  GET  /api/search/:query             - поиск тикеров`);
    console.log(`  GET  /api/stock/:symbol             - получение цены акции`);
    console.log(`  POST /api/stocks/batch              - получение цен нескольких акций`);
    console.log(`  GET  /api/tickers                   - список всех тикеров`);
});

export default app;