# Art Bidding System API Documentation

This document describes all REST endpoints implemented in this project.

## Base URL

```
http://localhost:3000
```

## Auth

Most routes require a Bearer token:

```
Authorization: Bearer <JWT_TOKEN>
```

### Roles
- `SENIMAN` (artist)
- `KURATOR` (curator)
- `KOLEKTOR` (collector)

## Common Responses

- **401 Unauthorized** → missing/invalid token
- **403 Forbidden** → role not allowed
- **404 Not Found** → record not found

## Health Check

### GET `/health`
Checks service availability for Prisma (PostgreSQL) and Redis.

**Response 200**
```json
{
  "status": "ok",
  "checks": {
    "prisma": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}
```

**Response 503**
```json
{
  "status": "degraded",
  "checks": {
    "prisma": { "status": "error", "error": "..." },
    "redis": { "status": "error", "error": "..." }
  }
}
```

---

# User Routes (`/user`)

### POST `/user/login`
Login using username or email.

**Body**
```json
{
  "username": "arya",
  "email": "arya@mail.com",
  "password": "secret"
}
```

**Response 200**
```json
{ "token": "<jwt>" }
```

### POST `/user/register`
Register new user.

**Body**
```json
{
  "username": "arya",
  "full_name": "Arya Putra",
  "email": "arya@mail.com",
  "phone_number": "0812345678",
  "password": "secret",
  "role": "SENIMAN",
  "alt_name": "Anonymous"
}
```

**Response 201**
```json
{ "id": "<user_id>" }
```

### PUT `/user/update/profile`
Update profile (requires auth).

**Body**
```json
{
  "full_name": "Arya Putra",
  "alt_name": "Anonymous"
}
```

### PUT `/user/update/password`
Change password (requires auth).

**Body**
```json
{
  "password": "new_secret"
}
```

### DELETE `/user/delete`
Delete account (requires auth).

---

# Artwork Routes (`/karya-seni`)

### POST `/karya-seni/create`
Create artwork (requires `SENIMAN`).

**Body**
```json
{
  "nama_karya": "Sunset",
  "deskripsi": "Oil on canvas",
  "katalog": "Modern",
  "tags": "oil,canvas,sunset",
  "min_bid_ammount": 1000,
  "open_bid_time": "2026-05-16T10:00:00Z",
  "close_bid_time": "2026-05-20T10:00:00Z"
}
```

### GET `/karya-seni/all`
List artworks, optional katalog filter.

**Query**
```
?katalog=Modern,Classic
```

### GET `/karya-seni/:id`
Get artwork details.

### PUT `/karya-seni/:id/owns`
Update ownership to current user (requires auth).

### PUT `/karya-seni/:id/detail`
Update artwork details (requires `SENIMAN`, only owner/artist).

### DELETE `/karya-seni/:id/delete`
Delete artwork (requires `SENIMAN` or `KURATOR`).

### PUT `/karya-seni/:id/verify`
Verify artwork (requires `KURATOR`).

### PUT `/karya-seni/:id/unverify`
Unverify artwork (requires `KURATOR`).

### POST `/karya-seni/:id/image`
Upload artwork image to GCS (requires `SENIMAN`).

**Content-Type**
`multipart/form-data`

**Form Data**
- `image` (file, required)

**Response 200**
```json
{
  "artwork": {
    "id": "<artwork_id>",
    "image_url": "https://storage.googleapis.com/<bucket>/artworks/<file>.jpg"
  },
  "image_url": "https://storage.googleapis.com/<bucket>/artworks/<file>.jpg",
  "gs_uri": "gs://<bucket>/artworks/<file>.jpg"
}
```

---

# Bidding Routes (`/bid`)

### POST `/bid/new`
Create new bid (requires auth).

**Body**
```json
{
  "artworks_id": "<artwork_id>",
  "ammount": 1200
}
```

### PUT `/bid/:id/cancle`
Cancel bid (requires auth).

### GET `/bid/:id/detail`
Get bid detail (requires auth).

### GET `/bid/low-high`
Get lowest and highest bid (requires auth).

### GET `/bid`
Get all bids (requires auth).

---

# Payments Routes (`/payments`)

### POST `/payments`
Create new payment (requires auth).

**Body**
```json
{
  "ammounts": 1500,
  "fee": 0.035,
  "for_bid": "<bid_id>"
}
```

### GET `/payments`
List payment history for current user (requires auth).
