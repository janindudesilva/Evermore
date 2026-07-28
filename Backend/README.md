# LOOM API

Express + MongoDB backend for the LOOM clothing store frontend.

## Setup

```
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — local MongoDB (`mongodb://localhost:27017/loom`) or a MongoDB Atlas connection string
- `JWT_SECRET` — any long random string

## Run

```
npm run seed   # loads the product catalog + an admin user (admin@loom.com / admin123)
npm run dev    # starts the API on http://localhost:5000 with nodemon
```

## Endpoints

| Method | Route                     | Access          | Notes                                  |
|--------|---------------------------|-----------------|-----------------------------------------|
| POST   | /api/auth/register        | Public          | Creates a customer account              |
| POST   | /api/auth/login           | Public          | Returns `{ user, token }`               |
| GET    | /api/auth/me              | Account         | Requires `Authorization: Bearer <token>`|
| GET    | /api/products             | Public          | `?category=` and `?q=` filters          |
| GET    | /api/products/:id         | Public          |                                          |
| POST   | /api/products             | Admin           |                                          |
| PUT    | /api/products/:id         | Admin           |                                          |
| DELETE | /api/products/:id         | Admin           |                                          |
| POST   | /api/orders               | Guest or Account| See below                               |
| GET    | /api/orders/mine          | Account         | Order history                           |
| GET    | /api/orders               | Admin           | All orders                              |
| PUT    | /api/orders/:id/status    | Admin           | Update order status                     |

### Guest vs. account checkout

`POST /api/orders` works both ways:
- **Logged in:** send the JWT in the `Authorization` header; omit `guestInfo`. The order is linked to `user`.
- **Guest:** omit the `Authorization` header; include `guestInfo: { name, email, phone, address, city, postalCode }`. The order is stored with `guestInfo` and no `user`.

Request body shape:
```json
{
  "items": [{ "productId": "...", "size": "M", "qty": 1 }],
  "guestInfo": { "name": "...", "email": "...", "phone": "...", "address": "...", "city": "...", "postalCode": "..." }
}
```

Prices are always re-fetched from the database server-side — the client never dictates the price charged.

## Wiring up the React frontend

In `AuthContext.jsx`, replace the mock `login`/`register` with real calls to `/api/auth/login` and `/api/auth/register`, storing the returned `token` (e.g. in memory or `localStorage`, matching the BizExchange convention). In `Checkout.jsx`, POST to `/api/orders` with the cart items and either the stored token or the guest form fields.
