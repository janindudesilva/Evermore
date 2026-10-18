# EVERMORE API

Express 5 + MongoDB backend for the **EVERMORE** clothing brand e-commerce platform.

## Configuration & Environment Variables

Create `.env` in `Backend/` based on `.env.example`:

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | API listening port | `5000` |
| `MONGO_URI` | MongoDB connection URI | `mongodb://localhost:27017/evermore` |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens | Long random 64-character hex string |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins | `http://localhost:5173,http://localhost:3000` |
| `ALLOW_SEED_OVERWRITE` | Safety flag to allow clearing products during seed | `false` |
| `ADMIN_EMAIL` | Default administrator account email for seed | `admin@theevermore.com` |
| `ADMIN_INITIAL_PASSWORD` | Administrator initial password for seed | Secure custom passphrase |

## Setup & Running

```bash
# Install dependencies
npm install

# Seed catalog & admin safely (non-destructive if DB populated)
npm run seed

# Run in development mode with nodemon
npm run dev

# Run in production mode
npm start
```

## API Specification

### 1. Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a customer account (rate limited)
- `POST /api/auth/login` — Sign in and obtain JWT (rate limited)
- `GET /api/auth/me` — Current authenticated user profile
- `PUT /api/auth/profile` — Update account profile (name, phone, delivery address)

### 2. Product Catalog (`/api/products`)
- `GET /api/products?category=...&q=...&page=1&limit=24` — Paginated product catalog
- `GET /api/products/:id` — Single product details with size and stock information
- `POST /api/products` — Admin only: Create new garment with sizes & stock
- `PUT /api/products/:id` — Admin only: Update garment attributes
- `DELETE /api/products/:id` — Admin only: Deactivate product

### 3. Orders & Checkout (`/api/orders`)
- `POST /api/orders` — Create order (rate limited, supports guests and authenticated customers). Atomic inventory reservation per size.
- `GET /api/orders/mine` — Customer order history with pagination
- `GET /api/orders/:id` — View specific order details
- `POST /api/orders/:id/cancel` — Customer order cancellation (for pending orders only, restores stock)
- `GET /api/orders` — Admin only: Paginated list of all customer orders
- `PUT /api/orders/:id/status` — Admin only: Order state transition with state machine enforcement

### 4. Inquiries & Newsletter (`/api/inquiries`)
- `POST /api/inquiries/contact` — Customer contact inquiry (rate limited)
- `POST /api/inquiries/newsletter` — Mailing list signup (rate limited)

### 5. Health Check
- `GET /api/health` — Returns status, database connection, and timestamp
