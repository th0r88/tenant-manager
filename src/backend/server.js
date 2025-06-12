import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database/db.js';
import tenantsRouter from './routes/tenants.js';
import utilitiesRouter from './routes/utilities.js';
import reportsRouter from './routes/reports.js';
import propertiesRouter from './routes/properties.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Tenant Manager API is running' });
});

app.use('/api/properties', propertiesRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/utilities', utilitiesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/dashboard', dashboardRouter);

async function startServer() {
    try {
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();