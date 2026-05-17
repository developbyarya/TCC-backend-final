# TCC Backend Final

Single-project Express API for the art bidding system routes in `API_ROUTES.md`.

## ✅ Tech Stack
- Express
- Prisma ORM (PostgreSQL)
- Redis
- JWT + bcrypt authentication
- CORS enabled for all routes

## 📦 Setup
Create a `.env` file with:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://localhost:6379
PORT=3000
```

## ▶ Run
```
npm install
npm run dev
```

## 🧪 Seed + Endpoint Test
This script registers demo users, creates artworks with random images, runs bidding/payment flows, and verifies key endpoints. The API server must be running.

```
npm run seed:test
```

Optional overrides:

```
BASE_URL=http://localhost:3000 npm run seed:test
DRY_RUN=1 npm run seed:test
```

## 🧪 Prisma
```
npm run prisma:generate
npm run prisma:migrate
```

## 📌 Routes
See `API_ROUTES.md` for full endpoints.
